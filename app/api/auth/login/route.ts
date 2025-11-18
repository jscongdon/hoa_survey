import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { signToken } from '@/lib/auth/jwt'
import { loginSchema } from '@/lib/validation/schemas'
import { ZodError } from 'zod'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = loginSchema.parse(body)

    const admin = await prisma.admin.findUnique({ where: { email } })
    if (!admin) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const isValid = await verifyPassword(password, admin.password)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Check if admin has verified their email (LIMITED role means unverified)
    if (admin.role === 'LIMITED') {
      return NextResponse.json({ 
        error: 'Please verify your email address to activate your account.',
        needsVerification: true,
        email: admin.email
      }, { status: 403 })
    }

    // If 2FA required, short-circuit
    if (admin.twoFactor && admin.secret2FA) {
      return NextResponse.json({ requiresTwoFactor: true, adminId: admin.id })
    }

    const token = await signToken({ adminId: admin.id, email: admin.email, role: admin.role })
    const res = NextResponse.json({ success: true })
    res.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60,
    })
    return res
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
