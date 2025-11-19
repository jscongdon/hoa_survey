import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, generateBaseEmail } from '@/lib/email/send'
import crypto from 'crypto'
import { verifyToken } from '@/lib/auth/jwt'
import { log } from '@/lib/logger'

export async function POST(req: Request) {
  try {
    // Identify current admin from Authorization header or cookie
    const authHeader = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    let token = authHeader || ''
    if (!token) {
      const cookieHeader = req.headers.get('cookie') || ''
      const match = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('auth-token='))
      if (match) token = match.split('=')[1]
    }
    const payload = token ? await verifyToken(token) : null
    if (!payload?.adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await prisma.admin.findUnique({ where: { id: payload.adminId } })
    if (!admin) return NextResponse.json({ error: 'Admin not found' }, { status: 404 })

    // Generate reset token and expiry
    const tokenStr = crypto.randomBytes(32).toString('hex')
    const expiryHours = parseInt(process.env.RESET_TOKEN_EXPIRY_HOURS || '24', 10)
    const expiry = new Date(Date.now() + expiryHours * 60 * 60 * 1000)

    // Clear the password and set reset token fields
    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        password: '',
        resetToken: tokenStr,
        resetTokenExpires: expiry,
      },
    })

    // Build reset URL similar to other flows
    const sys = await prisma.systemConfig.findUnique({ where: { id: 'system' } })
    let appUrl: string | undefined = sys?.appUrl || undefined
    if (!appUrl) {
      if (process.env.NODE_ENV === 'development') {
        appUrl = process.env.DEVELOPMENT_URL || 'http://localhost:3000'
      } else {
        appUrl = process.env.PRODUCTION_URL || ''
        if (!appUrl) {
          return NextResponse.json({ error: 'Production URL not configured' }, { status: 500 })
        }
      }
    }

    const resetUrl = `${appUrl.replace(/\/$/, '')}/reset-password?token=${tokenStr}`
    log(`[RESET_MY_PW] Generated reset URL: ${resetUrl} (admin=${admin.id}) expires=${expiry.toISOString()}`)

    const bodyHtml = `
      <p>You requested to reset your administrator password.</p>
      <p>This link will expire on ${expiry.toISOString()}.</p>
    `;

    const html = generateBaseEmail(
      'Password Reset Request',
      `<p>Hello ${admin.name || ''},</p>`,
      bodyHtml,
      { text: 'Reset Password', url: resetUrl },
      `This link will expire on ${expiry.toISOString()}.`
    );

    await sendEmail({
      to: admin.email,
      subject: 'HOA Survey — Reset Your Admin Password',
      html,
    })

    // Clear auth cookie so the user is logged out after requesting a self-reset
    const res = NextResponse.json({ ok: true })
    res.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })

    return res
  } catch (err: any) {
    console.error('[reset-my-password] error:', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
