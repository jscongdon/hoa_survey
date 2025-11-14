import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email/send'
import { signToken } from '@/lib/auth/jwt'
import crypto from 'crypto'

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
    // Store as a pending admin with invite token
    const admin = await prisma.admin.create({
      data: {
        email,
        name,
        password: '',
        role: role || 'VIEW_ONLY',
        invitedById,
        secret2FA: token // store token in secret2FA until accepted
      }
    })
    // Send invite email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const inviteUrl = `${appUrl}/invite/${token}`
    await sendEmail({
      to: email,
      subject: 'HOA Survey Admin Invite',
      html: `<p>You have been invited as an admin. Click <a href="${inviteUrl}">here</a> to set your password and activate your account.</p>`
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
