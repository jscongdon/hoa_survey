import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  try {
    const { smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, testEmail } = await req.json()

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom || !testEmail) {
      return NextResponse.json(
        { error: 'All SMTP fields are required' },
        { status: 400 }
      )
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    })

    // Verify connection
    await transporter.verify()

    // Send test email
    await transporter.sendMail({
      from: smtpFrom,
      to: testEmail,
      subject: 'HOA Survey - Email Configuration Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Email Configuration Successful!</h2>
          <p>Your SMTP settings are working correctly.</p>
          <p>You can now proceed with setting up your administrator account.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated test email from HOA Survey setup wizard.
          </p>
        </div>
      `
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Test email error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send test email' },
      { status: 500 }
    )
  }
}
