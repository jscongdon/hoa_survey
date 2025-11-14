import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email/send'
import crypto from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    
    // Find the response
    const response = await prisma.response.findUnique({
      where: { token },
      include: {
        survey: true,
        member: true,
      },
    })

    if (!response) {
      return NextResponse.json({ error: 'Response not found' }, { status: 404 })
    }

    if (!response.submittedAt) {
      return NextResponse.json({ error: 'Response must be submitted first' }, { status: 400 })
    }

    if (response.signed) {
      return NextResponse.json({ error: 'Response is already signed' }, { status: 400 })
    }

    // Generate a unique signature token
    const signatureToken = crypto.randomBytes(32).toString('hex')

    // Update the response with the signature token
    await prisma.response.update({
      where: { id: response.id },
      data: { signatureToken },
    })

    // Send signature request email
    const signatureUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL}/survey/${token}/sign/${signatureToken}`
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Survey Response Signature Request</h2>
        <p>Hello ${response.member.name},</p>
        <p>Your survey response for <strong>"${response.survey.title}"</strong> has been received.</p>
        <p>To validate the authenticity of your submission and finalize your response, please click the link below to digitally sign your submission:</p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${signatureUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Sign My Response</a>
        </div>
        <p><strong>Important:</strong> Once you sign your response, it can no longer be changed or edited.</p>
        <p>If you did not submit this response or do not wish to sign it, please disregard this email.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">This link will expire when the survey closes or if a new signature request is made.</p>
      </div>
    `

    await sendEmail({
      to: response.member.email,
      subject: `Signature Required: ${response.survey.title}`,
      html: emailHtml,
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Signature request email sent successfully' 
    })
  } catch (error) {
    console.error('Error requesting signature:', error)
    return NextResponse.json({ error: 'Failed to send signature request' }, { status: 500 })
  }
}
