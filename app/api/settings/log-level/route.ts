import { log, error as logError } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth/jwt'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const payload = await verifyToken(token)
    if (!payload?.adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const config = await prisma.systemConfig.findUnique({ where: { id: 'system' } })
    const logLevel = config?.logLevel || null
    return NextResponse.json({ logLevel })
  } catch (err: any) {
    logError('Get log-level error:', err)
    return NextResponse.json({ error: 'Failed to get log level' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const payload = await verifyToken(token)
    if (!payload?.adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { logLevel } = await request.json()
    const allowed = ['debug', 'info', 'warn', 'error']
    if (!allowed.includes(logLevel)) {
      return NextResponse.json({ error: 'Invalid log level' }, { status: 400 })
    }

    await prisma.systemConfig.update({ where: { id: 'system' }, data: { logLevel } })
    return NextResponse.json({ success: true, logLevel })
  } catch (err: any) {
    logError('Update log-level error:', err)
    return NextResponse.json({ error: 'Failed to update log level' }, { status: 500 })
  }
}
