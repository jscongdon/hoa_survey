import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth/password'
import { signToken } from '@/lib/auth/jwt'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { token, password } = body
    // Find pending admin by invite token (stored in secret2FA)
    const admin = await prisma.admin.findFirst({ where: { secret2FA: token, password: '' } })
    if (!admin) return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 400 })
    const hashed = await hashPassword(password)
    // Activate admin: set password, clear invite token
    await prisma.admin.update({
      where: { id: admin.id },
      data: { password: hashed, secret2FA: null }
    })
    const jwt = signToken({ id: admin.id, email: admin.email, role: admin.role })
    return NextResponse.json({ token: jwt })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
