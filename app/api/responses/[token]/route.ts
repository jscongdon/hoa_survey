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
    },
  })

  if (!response) {
    return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
  }

  const now = new Date()
  const isClosed = response.survey.closesAt && now > response.survey.closesAt
  
  // Parse existing answers if response was submitted
  const existingAnswers = response.submittedAt && response.answers 
    ? JSON.parse(response.answers as string)
    : null

  return NextResponse.json({
    ...response,
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

    const response = await prisma.response.update({
      where: { token },
      data: {
        answers: JSON.stringify(answers),
        submittedAt: new Date(),
        signatureToken,
      },
    })

    // Send signature request email
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      const signatureUrl = `${baseUrl}/survey/${token}/sign/${signatureToken}`
      const viewResponseUrl = `${baseUrl}/survey/${token}`

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
      console.error('Failed to send signature email:', emailError)
      // Continue even if email fails - response was saved successfully
    }

    return NextResponse.json({ success: true, response })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to submit response' }, { status: 500 })
  }
}
