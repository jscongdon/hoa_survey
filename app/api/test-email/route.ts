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
    const { testEmail } = body;

    if (!testEmail || !testEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Valid test email address required' },
        { status: 400 }
      );
    }

    // Check if SMTP settings are configured
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return NextResponse.json(
        { 
          error: 'SMTP settings not configured',
          details: 'Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in your .env file'
        },
        { status: 400 }
      );
    }

    // Create transporter with current settings
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Verify connection
    await transporter.verify();

    // Send test email
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@hoa.local',
      to: testEmail,
      subject: 'HOA Survey System - SMTP Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #3b82f6;">✅ SMTP Configuration Test</h2>
          <p>This is a test email from your HOA Survey System.</p>
          <p><strong>Your SMTP settings are working correctly!</strong></p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;" />
          <p style="font-size: 12px; color: #666;">
            Server: ${process.env.SMTP_HOST}<br>
            Port: ${process.env.SMTP_PORT || '587'}<br>
            User: ${process.env.SMTP_USER}<br>
            From: ${process.env.SMTP_FROM || 'noreply@hoa.local'}
          </p>
        </div>
      `,
      text: `
SMTP Configuration Test

This is a test email from your HOA Survey System.
Your SMTP settings are working correctly!

Server: ${process.env.SMTP_HOST}
Port: ${process.env.SMTP_PORT || '587'}
User: ${process.env.SMTP_USER}
From: ${process.env.SMTP_FROM || 'noreply@hoa.local'}
      `,
    });

    return NextResponse.json({
      success: true,
      message: `Test email sent successfully to ${testEmail}`,
      config: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || '587',
        user: process.env.SMTP_USER,
        from: process.env.SMTP_FROM || 'noreply@hoa.local',
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
