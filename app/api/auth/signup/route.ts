import { log, error as logError } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth/password'
import { signToken } from '@/lib/auth/jwt'
import { inviteAdminSchema } from '@/lib/validation/schemas'
import { ZodError } from 'zod'

// Create first admin or invited admin
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const inviteToken = request.headers.get('x-invite-token')

    // Check if this is the first admin signup
    const adminCount = await prisma.admin.count()

    if (adminCount > 0 && !inviteToken) {
      return NextResponse.json({ error: 'Invite token required' }, { status: 403 })
    }

    const { email, password, name } = body

    // Validate input
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Email, password, and name are required' }, { status: 400 })
    }

    const existingAdmin = await prisma.admin.findUnique({ where: { email } })
    if (existingAdmin) return NextResponse.json({ error: 'Admin already exists' }, { status: 409 })

    const hashedPassword = await hashPassword(password)

    const admin = await prisma.admin.create({
      data: { email, password: hashedPassword, name, role: 'FULL' },
    })

    const token = await signToken({ adminId: admin.id, email: admin.email, role: admin.role })

    const response = NextResponse.json({ success: true })
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60,
    })

    return response
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 })
    }
    logError(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
