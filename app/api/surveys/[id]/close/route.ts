import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth/jwt'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload?.adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if admin has FULL role
    const admin = await prisma.admin.findUnique({
      where: { id: payload.adminId },
    })

    if (!admin || admin.role !== 'FULL') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params

    // Update the survey's close date to now
    const survey = await prisma.survey.update({
      where: { id },
      data: {
        closesAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, survey })
  } catch (error) {
    console.error('Error closing survey:', error)
    return NextResponse.json({ error: 'Failed to close survey' }, { status: 500 })
  }
}
