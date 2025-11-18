import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email/send'
import { signToken } from '@/lib/auth/jwt'
import crypto from 'crypto'
import { log } from '@/lib/logger'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, name, invitedById, role } = body
    // Only allow if current user is FULL admin (should check JWT in real app)
    const inviter = await prisma.admin.findUnique({ where: { id: invitedById } })
    if (!inviter || inviter.role !== 'FULL') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
    // Generate invite token
    const token = crypto.randomBytes(32).toString('hex')
    // Store as a pending admin with invite token and expiry
    const expiryDays = parseInt(process.env.INVITE_EXPIRY_DAYS || '7', 10)
    const expiry = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
    const admin = await prisma.admin.create({
      data: {
        email,
        name,
        password: '',
        role: role || 'VIEW_ONLY',
        invitedById,
        secret2FA: token, // store token in secret2FA until accepted
        inviteExpires: expiry
      }
    })
    // Send invite email
    // Prefer a configured app URL in the SystemConfig (allows correct host/port),
    // fall back to environment variables.
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
    const inviteUrl = `${appUrl.replace(/\/$/, '')}/invite/${token}`
    log(`[INVITE] Generated invite URL: ${inviteUrl} (inviter=${invitedById}) expires=${expiry.toISOString()}`)
    await sendEmail({
      to: email,
      subject: 'HOA Survey Admin Invite',
      html: `<p>You have been invited as an admin. Click <a href="${inviteUrl}">here</a> to set your password and activate your account.</p><p>This invite will expire on ${expiry.toISOString()}.</p>`
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
