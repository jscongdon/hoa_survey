import { log, error as logError } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email/send'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Check if admin exists
    const admin = await prisma.admin.findUnique({ where: { email } })
    
    // Always return success to prevent email enumeration
    if (!admin) {
      return NextResponse.json({ 
        success: true, 
        message: 'If an account exists with this email, you will receive a password reset link.' 
      })
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    
    // Store token in database
    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        resetToken: token,
        resetTokenExpires: expires,
      },
    })
    
    log('[FORGOT-PASSWORD] Stored token in DB for email:', admin.email)

    // Get system config for app URL
    const config = await prisma.systemConfig.findUnique({ where: { id: 'system' } })
    const isDevelopment = process.env.NODE_ENV === 'development'
    const baseUrl = isDevelopment 
      ? (config?.appUrl || process.env.DEVELOPMENT_URL || 'http://localhost:3000')
      : (config?.appUrl || process.env.PRODUCTION_URL || 'http://localhost:3000')

    const resetUrl = `${baseUrl}/reset-password?token=${token}`

    // Send email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Password Reset Request</h2>
        <p>Hello ${admin.name || 'Admin'},</p>
        <p>You requested to reset your password. Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
        </div>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this password reset, you can safely ignore this email.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">This is an automated email. Please do not reply directly to this message.</p>
      </div>
    `

    await sendEmail({
      to: admin.email,
      subject: 'Password Reset Request',
      html: emailHtml,
    })

    return NextResponse.json({ 
      success: true, 
      message: 'If an account exists with this email, you will receive a password reset link.' 
    })
  } catch (error) {
    logError('Forgot password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
