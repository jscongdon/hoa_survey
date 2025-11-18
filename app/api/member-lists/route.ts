import { log, error as logError } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth/jwt'
import Papa from 'papaparse'

export async function GET(request: NextRequest) {
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

  const lists = await prisma.memberList.findMany({
    include: { _count: { select: { members: true, surveys: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(lists)
}

export async function POST(request: NextRequest) {
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

  try {
    const formData = await request.formData()
    const name = formData.get('name') as string
    const csvFile = formData.get('csv') as File

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    let members: Array<{ lot: string; name: string; email: string; address?: string }> = []

    if (csvFile) {
      const csvText = await csvFile.text()
      const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
      })

      members = parsed.data as typeof members
      
      // Validate email format for all members
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = members.filter(m => m.email && !emailRegex.test(m.email));
      
      if (invalidEmails.length > 0) {
        return NextResponse.json(
          { 
            error: 'Invalid email format detected', 
            details: `Found ${invalidEmails.length} invalid email(s). Please check your CSV file.` 
          }, 
          { status: 400 }
        );
      }
    }

    const memberList = await prisma.memberList.create({
      data: {
        name,
        members: {
          create: members.map((m) => ({
            lot: m.lot,
            name: m.name,
            email: m.email,
            address: m.address,
          })),
        },
      },
      include: { _count: { select: { members: true, surveys: true } } },
    })

    return NextResponse.json(memberList, { status: 201 })
  } catch (error) {
    logError(error)
    return NextResponse.json({ error: 'Failed to create member list' }, { status: 500 })
  }
}
