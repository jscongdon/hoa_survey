import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth/jwt'
import { canManageAdmin } from '@/lib/auth/permissions'

export async function PATCH(
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

    const { id } = await params
    const body = await request.json()
    const { role, twoFactor } = body

    const isSelf = id === payload.adminId

    // Users can manage themselves but only for 2FA, not role
    if (isSelf) {
      if (role !== undefined) {
        return NextResponse.json({ error: 'Cannot change your own role' }, { status: 403 })
      }
      // Allow updating own 2FA
      const updateData: any = {}
      if (twoFactor !== undefined) updateData.twoFactor = twoFactor
      
      const admin = await prisma.admin.update({
        where: { id },
        data: updateData,
      })
      
      return NextResponse.json({ success: true, admin })
    }

    // Check if current admin can manage the target admin
    const canManage = await canManageAdmin(payload.adminId, id)
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const updateData: any = {}
    if (role !== undefined) updateData.role = role
    if (twoFactor !== undefined) updateData.twoFactor = twoFactor

    const admin = await prisma.admin.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ success: true, admin })
  } catch (error) {
    console.error('Error updating admin:', error)
    return NextResponse.json({ error: 'Failed to update admin' }, { status: 500 })
  }
}

export async function DELETE(
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

    const { id } = await params

    // Prevent deleting yourself
    if (id === payload.adminId) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    // Check if current admin can manage the target admin
    const canManage = await canManageAdmin(payload.adminId, id)
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    await prisma.admin.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting admin:', error)
    return NextResponse.json({ error: 'Failed to delete admin' }, { status: 500 })
  }
}
