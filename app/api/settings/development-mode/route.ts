import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth/jwt'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload?.adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const config = await prisma.systemConfig.findUnique({
      where: { id: 'system' },
      select: { developmentMode: true }
    })

    return NextResponse.json({ developmentMode: config?.developmentMode ?? true })
  } catch (error: any) {
    console.error('Get development mode error:', error)
    return NextResponse.json({ error: 'Failed to get setting' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload?.adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { developmentMode } = await request.json()

    if (typeof developmentMode !== 'boolean') {
      return NextResponse.json({ error: 'developmentMode must be a boolean' }, { status: 400 })
    }

    await prisma.systemConfig.update({
      where: { id: 'system' },
      data: { developmentMode }
    })

    return NextResponse.json({ success: true, developmentMode })
  } catch (error: any) {
    console.error('Update development mode error:', error)
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 })
  }
}
