import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth/jwt'
import { prisma } from '@/lib/prisma'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// Environment variables that can be safely edited
const EDITABLE_ENV_VARS = [
  { key: 'SMTP_HOST', label: 'SMTP Host', type: 'text', category: 'Email' },
  { key: 'SMTP_PORT', label: 'SMTP Port', type: 'number', category: 'Email' },
  { key: 'SMTP_USER', label: 'SMTP Username', type: 'text', category: 'Email' },
  { key: 'SMTP_PASS', label: 'SMTP Password', type: 'password', category: 'Email' },
  { key: 'SMTP_FROM', label: 'From Email Address', type: 'email', category: 'Email' },
  { key: 'HOA_NAME', label: 'HOA Name', type: 'text', category: 'Branding' },
  { key: 'HOA_LOGO_URL', label: 'Logo URL', type: 'text', category: 'Branding' },
  { key: 'NEXT_PUBLIC_APP_URL', label: 'Application URL', type: 'url', category: 'Application' },
  { key: 'BASE_URL', label: 'Base URL', type: 'url', category: 'Application' },
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

    // Read current env values
    const envValues: Record<string, string> = {}
    EDITABLE_ENV_VARS.forEach(({ key }) => {
      envValues[key] = process.env[key] || ''
    })

    return NextResponse.json({ 
      variables: EDITABLE_ENV_VARS,
      values: envValues 
    })
  } catch (error) {
    console.error('Error fetching env variables:', error)
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

    // Validate that only editable variables are being updated
    const editableKeys = EDITABLE_ENV_VARS.map(v => v.key)
    for (const key of Object.keys(updates)) {
      if (!editableKeys.includes(key)) {
        return NextResponse.json({ error: `Cannot update ${key}` }, { status: 400 })
      }
    }

    // Read current .env file
    const envPath = join(process.cwd(), '.env')
    let envContent = readFileSync(envPath, 'utf-8')

    // Update each variable
    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, 'm')
      const newLine = `${key}="${value}"`
      
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, newLine)
      } else {
        // Add new variable if it doesn't exist
        envContent += `\n${newLine}\n`
      }
    }

    // Write back to .env file
    writeFileSync(envPath, envContent, 'utf-8')

    return NextResponse.json({ 
      success: true, 
      message: 'Environment variables updated. Restart the application for changes to take effect.' 
    })
  } catch (error) {
    console.error('Error updating env variables:', error)
    return NextResponse.json({ error: 'Failed to update environment variables' }, { status: 500 })
  }
}
