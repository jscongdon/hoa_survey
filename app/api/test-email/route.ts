import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
  // Verify admin authentication
  let adminId = request.headers.get('x-admin-id');
  if (!adminId) {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = await verifyToken(token as string);
    if (!payload?.adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    adminId = payload.adminId;
  }

  try {
    const body = await request.json();
    const { testEmail, smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom } = body;

    if (!testEmail || !testEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Valid test email address required' },
        { status: 400 }
      );
    }

    // Use provided SMTP settings or fall back to environment variables
    const host = smtpHost || process.env.SMTP_HOST;
    const port = smtpPort || process.env.SMTP_PORT || '587';
    const user = smtpUser || process.env.SMTP_USER;
    const pass = smtpPass || process.env.SMTP_PASS;
    const from = smtpFrom || process.env.SMTP_FROM || 'noreply@hoa.local';

    // Check if SMTP settings are available
    if (!host || !user || !pass) {
      return NextResponse.json(
        { 
          error: 'SMTP settings not configured',
          details: 'Please provide SMTP settings or set them in environment variables'
        },
        { status: 400 }
      );
    }

    // Create transporter with provided or configured settings
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure: port === '465',
      auth: {
        user,
        pass,
      },
    });

    // Verify connection
    await transporter.verify();

    // Send test email
    await transporter.sendMail({
      from,
      to: testEmail,
      subject: 'HOA Survey System - SMTP Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #3b82f6;">✅ SMTP Configuration Test</h2>
          <p>This is a test email from your HOA Survey System.</p>
          <p><strong>Your SMTP settings are working correctly!</strong></p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;" />
          <p style="font-size: 12px; color: #666;">
            Server: ${host}<br>
            Port: ${port}<br>
            User: ${user}<br>
            From: ${from}
          </p>
        </div>
      `,
      text: `
SMTP Configuration Test

This is a test email from your HOA Survey System.
Your SMTP settings are working correctly!

Server: ${host}
Port: ${port}
User: ${user}
From: ${from}
      `,
    });

    return NextResponse.json({
      success: true,
      message: `Test email sent successfully to ${testEmail}`,
      config: {
        host,
        port,
        user,
        from,
      },
    });
  } catch (error: any) {
    console.error('SMTP test error:', error);
    
    let errorMessage = 'Failed to send test email';
    let details = error.message || 'Unknown error';

    // Provide specific error messages for common issues
    if (error.code === 'EAUTH') {
      errorMessage = 'Authentication failed';
      details = 'Invalid SMTP username or password';
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Connection failed';
      details = 'Could not connect to SMTP server. Check host and port settings.';
    } else if (error.code === 'EENVELOPE') {
      errorMessage = 'Invalid sender or recipient';
      details = 'Check SMTP_FROM and recipient email addresses';
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        details,
        code: error.code,
      },
      { status: 500 }
    );
  }
}
