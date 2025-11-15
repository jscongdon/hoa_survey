import { log, error as logError } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth/jwt'
import { prisma } from '@/lib/prisma'

// Configuration fields that can be safely edited (stored in database)
const EDITABLE_CONFIG_FIELDS = [
  { key: 'smtpHost', label: 'SMTP Host', type: 'text', category: 'Email' },
  { key: 'smtpPort', label: 'SMTP Port', type: 'number', category: 'Email' },
  { key: 'smtpUser', label: 'SMTP Username', type: 'text', category: 'Email' },
  { key: 'smtpPass', label: 'SMTP Password', type: 'password', category: 'Email' },
  { key: 'smtpFrom', label: 'From Email Address', type: 'email', category: 'Email' },
  { key: 'hoaName', label: 'HOA Name', type: 'text', category: 'Branding' },
  { key: 'hoaLogoUrl', label: 'Logo URL', type: 'text', category: 'Branding' },
  { key: 'appUrl', label: 'Application URL', type: 'url', category: 'Application' },
]

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

    // Check if admin has FULL role
    const admin = await prisma.admin.findUnique({
      where: { id: payload.adminId },
    })

    if (!admin || admin.role !== 'FULL') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Read current config values from database
    const config = await prisma.systemConfig.findUnique({
      where: { id: 'system' }
    })

    const configValues: Record<string, string> = {}
    if (config) {
      EDITABLE_CONFIG_FIELDS.forEach(({ key }) => {
        // Convert database field names to values
        const value = config[key as keyof typeof config]
        configValues[key] = value?.toString() || ''
      })
    }

    return NextResponse.json({ 
      variables: EDITABLE_CONFIG_FIELDS,
      values: configValues 
    })
  } catch (error) {
    logError('Error fetching env variables:', error)
    return NextResponse.json({ error: 'Failed to fetch environment variables' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { updates } = body

    // Validate that only editable fields are being updated
    const editableKeys = EDITABLE_CONFIG_FIELDS.map(v => v.key)
    for (const key of Object.keys(updates)) {
      if (!editableKeys.includes(key)) {
        return NextResponse.json({ error: `Cannot update ${key}` }, { status: 400 })
      }
    }

    // Update the SystemConfig in database
    await prisma.systemConfig.update({
      where: { id: 'system' },
      data: updates
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Configuration updated successfully!' 
    })
  } catch (error) {
    logError('Error updating env variables:', error)
    return NextResponse.json({ error: 'Failed to update environment variables' }, { status: 500 })
  }
}
