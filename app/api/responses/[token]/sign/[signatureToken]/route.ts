import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email/send'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; signatureToken: string }> }
) {
  try {
    const { token, signatureToken } = await params
    
    // Find the response with matching tokens
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

    if (response.signatureToken !== signatureToken) {
      return NextResponse.json({ error: 'Invalid signature token' }, { status: 403 })
    }

    // Check if survey is still open (optional - you might want signatures even after close)
    // Uncomment if you want to prevent signatures after survey closes
    // const now = new Date()
    // if (response.survey.closesAt && now > response.survey.closesAt) {
    //   return NextResponse.json({ error: 'Survey has closed' }, { status: 400 })
    // }

    // Mark the response as signed
    await prisma.response.update({
      where: { id: response.id },
      data: {
        signed: true,
        signedAt: new Date(),
      },
    })

    // Send confirmation email
    const submittedDate = new Date(response.submittedAt).toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    const signedDate = new Date().toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Survey Response Signature Confirmed</h2>
        <p>Hello ${response.member.name},</p>
        <p>Your digital signature has been successfully received and recorded for your survey response:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Survey:</strong> ${response.survey.title}</p>
          <p style="margin: 5px 0;"><strong>Submitted:</strong> ${submittedDate} EST</p>
          <p style="margin: 5px 0;"><strong>Signed:</strong> ${signedDate} EST</p>
        </div>
        <p>Your response is now finalized and can no longer be edited or changed.</p>
        <p>Thank you for completing the survey!</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">This is an automated confirmation email. Please keep this for your records.</p>
      </div>
    `

    await sendEmail({
      to: response.member.email,
      subject: `Signature Confirmed: ${response.survey.title}`,
      html: emailHtml,
    })

    return NextResponse.json({ 
      success: true,
      message: 'Response signed successfully',
      signedAt: new Date(),
    })
  } catch (error) {
    console.error('Error signing response:', error)
    return NextResponse.json({ error: 'Failed to sign response' }, { status: 500 })
  }
}
