import { log, error as logError } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email/send'
import crypto from 'crypto'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const response = await prisma.response.findUnique({
    where: { token },
    include: {
      survey: { include: { questions: { orderBy: { order: 'asc' } } } },
      member: true,
      answers: true,
    },
  })

  if (!response) {
    return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
  }

  const now = new Date()
  const isClosed = response.survey.closesAt && now > response.survey.closesAt
  
  // Convert answers array to object with questionId as key
  const existingAnswers = response.submittedAt && response.answers.length > 0
    ? response.answers.reduce((acc, answer) => {
        // Parse arrays stored as JSON strings
        try {
          acc[answer.questionId] = JSON.parse(answer.value)
        } catch {
          acc[answer.questionId] = answer.value
        }
        return acc
      }, {} as Record<string, any>)
    : null

  // Parse survey questions options and showWhen for client consumption
  const parsedSurvey = response.survey
    ? {
        ...response.survey,
        questions: response.survey.questions.map((q: any) => ({
          id: q.id,
          surveyId: q.surveyId,
          type: q.type,
          text: q.text,
          order: q.order,
          options: q.options ? JSON.parse(q.options) : undefined,
          showWhen: q.showWhen ? JSON.parse(q.showWhen) : undefined,
          maxSelections: q.maxSelections || undefined,
          required: q.required || false,
        })),
      }
    : null

  return NextResponse.json({
    ...response,
    survey: parsedSurvey,
    isClosed,
    existingAnswers,
    signed: response.signed,
    signedAt: response.signedAt,
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const body = await request.json()
    const { answers } = body
    const { token } = await params

    // Check if survey is still open
    const existingResponse = await prisma.response.findUnique({
      where: { token },
      include: { 
        survey: true,
        member: true,
      },
    })

    if (!existingResponse) {
      return NextResponse.json({ error: 'Response not found' }, { status: 404 })
    }

    // Check if response is signed (cannot be edited)
    if (existingResponse.signed) {
      return NextResponse.json({ error: 'This response has been digitally signed and can no longer be edited' }, { status: 403 })
    }

    const now = new Date()
    if (existingResponse.survey.closesAt && now > existingResponse.survey.closesAt) {
      return NextResponse.json({ error: 'Survey is closed' }, { status: 403 })
    }

    // Generate signature token
    const signatureToken = crypto.randomBytes(32).toString('hex')

    // Delete existing answers and create new ones
    await prisma.answer.deleteMany({
      where: { responseId: existingResponse.id },
    })

    // Load survey questions (ordered) so we can evaluate any showWhen conditions
    const surveyWithQuestions = await prisma.survey.findUnique({
      where: { id: existingResponse.surveyId },
      include: { questions: { orderBy: { order: 'asc' } } },
    })

    const questions = surveyWithQuestions?.questions ?? []

    // Helper: determine if a question should be considered enabled given submitted answers
    function isQuestionEnabled(q: any, submittedAnswers: Record<string, any>): boolean {
      if (!q.showWhen) return true
      try {
        const cond = typeof q.showWhen === 'string' ? JSON.parse(q.showWhen) : q.showWhen
        const triggerOrder = cond.triggerOrder
        const operator = cond.operator
        const expected = cond.value
        // Find trigger question by order
        const trigger = questions.find(t => t.order === triggerOrder)
        if (!trigger) return false
        const triggerAns = submittedAnswers[trigger.id]
        if (triggerAns === null || triggerAns === undefined || triggerAns === '') return false

        // Normalize answers for comparison
        if (Array.isArray(triggerAns)) {
          if (operator === 'equals') {
            return triggerAns.includes(expected)
          }
          // contains on an array -> treat as includes
          return triggerAns.some((a: any) => String(a).includes(String(expected)))
        }

        const asStr = String(triggerAns)
        if (operator === 'equals') return asStr === String(expected)
        return asStr.includes(String(expected))
      } catch (e) {
        return false
      }
    }

    // Filter out answers for questions that are disabled by showWhen
    const allowedAnswerEntries = Object.entries(answers)
      .filter(([, value]) => {
        // Skip empty values up-front
        if (value === null || value === undefined || value === '') return false
        if (Array.isArray(value) && value.length === 0) return false
        return true
      })
      .filter(([questionId]) => {
        // Find question object for this id
        const q = questions.find(q2 => q2.id === questionId)
        // If question not found in survey, skip it
        if (!q) return false
        return isQuestionEnabled(q, answers)
      })
      .map(([questionId, value]) => ({
        responseId: existingResponse.id,
        questionId,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
      }))

    const response = await prisma.response.update({
      where: { token },
      data: {
        answers: {
          create: allowedAnswerEntries,
        },
        submittedAt: new Date(),
        signatureToken,
      },
    })

    // Send signature request email
    try {
      const isDevelopment = process.env.NODE_ENV === 'development';
      let baseUrl: string;
      if (isDevelopment) {
        baseUrl = process.env.DEVELOPMENT_URL || 'http://localhost:3000';
      } else {
        baseUrl = process.env.PRODUCTION_URL || '';
        if (!baseUrl) {
          throw new Error('Production URL not configured');
        }
      }
      const signatureUrl = `${baseUrl}/survey/${token}/sign/${signatureToken}`;
      const viewResponseUrl = `${baseUrl}/survey/${token}`;

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Digital Signature Request</h2>
          <p>Hello ${existingResponse.member.name},</p>
          <p>Thank you for submitting your response to the survey: <strong>${existingResponse.survey.title}</strong></p>
          <p>To validate the authenticity of your submission, please click the button below to digitally sign your response:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${signatureUrl}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Sign Your Response</a>
          </div>
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;"><strong>Important:</strong> Once you sign your response, it can no longer be changed or edited. Please review your answers before signing.</p>
          </div>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${viewResponseUrl}" style="color: #2563eb; text-decoration: none;">View Your Response</a>
          </div>
          <p>If you did not submit this response or have any questions, please contact the administrator.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">This is an automated email. Please do not reply directly to this message.</p>
        </div>
      `

      await sendEmail({
        to: existingResponse.member.email,
        subject: `Digital Signature Request: ${existingResponse.survey.title}`,
        html: emailHtml,
      })
    } catch (emailError) {
      logError('Failed to send signature email:', emailError)
      // Continue even if email fails - response was saved successfully
    }

    return NextResponse.json({ success: true, response })
  } catch (error) {
    logError(error)
    return NextResponse.json({ error: 'Failed to submit response' }, { status: 500 })
  }
}
