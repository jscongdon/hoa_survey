import { log, error as logError } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth/jwt'
import { getManagedAdmins } from '@/lib/auth/permissions'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload?.adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all admins that the current admin can manage
    const managedAdminIds = await getManagedAdmins(payload.adminId)
    
    // Include current admin so they can see themselves
    const allManagedIds = [...managedAdminIds, payload.adminId]

    const admins = await prisma.admin.findMany({
      where: {
        id: {
          in: allManagedIds,
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        twoFactor: true,
        invitedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        email: 'asc',
      },
    })

    return NextResponse.json({ admins })
  } catch (error) {
    logError('Error fetching admins:', error)
    return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 })
  }
}
