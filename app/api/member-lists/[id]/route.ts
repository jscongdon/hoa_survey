import { log, error as logError } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth/jwt'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let adminId = request.headers.get('x-admin-id')

  if (!adminId) {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const payload = await verifyToken(token as string)
    if (!payload?.adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    adminId = payload.adminId
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const list = await prisma.memberList.findUnique({
    where: { id },
    include: { members: true },
  })

  if (!list) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(list)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let adminId = request.headers.get('x-admin-id')

  if (!adminId) {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const payload = await verifyToken(token as string)
    if (!payload?.adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    adminId = payload.adminId
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const { name } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const list = await prisma.memberList.update({
      where: { id },
      data: { name: name.trim() },
      include: { _count: { select: { members: true, surveys: true } } },
    })

    return NextResponse.json(list)
  } catch (error) {
    logError(error)
    return NextResponse.json({ error: 'Failed to update member list' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let adminId = request.headers.get('x-admin-id')

  if (!adminId) {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const payload = await verifyToken(token as string)
    if (!payload?.adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    adminId = payload.adminId
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  try {
    // Delete the member list (cascades to members via Prisma schema relations)
    await prisma.memberList.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logError(error)
    return NextResponse.json({ error: 'Failed to delete member list' }, { status: 500 })
  }
}

