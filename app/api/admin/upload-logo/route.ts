import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth/jwt'
import prisma from '@/lib/prisma'
import { error as logError } from '@/lib/logger'
import fs from 'fs'
import path from 'path'

const MAX_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml']

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const payload = await verifyToken(token)
    if (!payload?.adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const contentLength = request.headers.get('content-length')
    if (contentLength) {
      const cl = parseInt(contentLength, 10)
      if (!isNaN(cl) && cl > MAX_SIZE) {
        return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
      }
    }

    const form = await request.formData()
    const file = form.get('file') as unknown as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const buffer = Buffer.from(await (file as any).arrayBuffer())
    if (buffer.length > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 2MB)' }, { status: 413 })
    }

    // Detect type via magic bytes / heuristic
    let detectedType: string | null = null
    if (buffer.length >= 8 && buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      detectedType = 'image/png'
    } else if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      detectedType = 'image/jpeg'
    } else {
      try {
        const start = buffer.toString('utf8', 0, Math.min(buffer.length, 1024)).toLowerCase()
        if (start.includes('<svg') || start.includes('<?xml')) detectedType = 'image/svg+xml'
      } catch (e) {
        detectedType = null
      }
    }

    if (!detectedType || !ALLOWED_TYPES.includes(detectedType)) {
      return NextResponse.json({ error: 'Invalid or unsupported file type' }, { status: 415 })
    }

    // Always write into the app's public/uploads directory so Next can serve the file directly
    const publicUploadsDir = path.join(process.cwd(), 'public', 'uploads')
    if (!fs.existsSync(publicUploadsDir)) fs.mkdirSync(publicUploadsDir, { recursive: true })

    let ext = ''
    if (detectedType === 'image/png') ext = 'png'
    else if (detectedType === 'image/jpeg') ext = 'jpg'
    else if (detectedType === 'image/svg+xml') ext = 'svg'

    const filename = `hoa-logo-${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`
    const publicFilePath = path.join(publicUploadsDir, filename)
    fs.writeFileSync(publicFilePath, buffer)

    const publicUrl = `/uploads/${filename}`

    const exists = fs.existsSync(publicFilePath)
    logError('[Upload] wrote file:', publicFilePath, 'exists=', exists)

    await prisma.systemConfig.upsert({
      where: { id: 'system' },
      update: { hoaLogoUrl: publicUrl },
      create: { id: 'system', hoaLogoUrl: publicUrl },
    })

    return NextResponse.json({ url: publicUrl, path: publicFilePath, saved: exists })
  } catch (err: any) {
    logError('Upload logo error:', err)
    return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const payload = await verifyToken(token)
    if (!payload?.adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const config = await prisma.systemConfig.findUnique({ where: { id: 'system' } })
    const hoaLogoUrl = config?.hoaLogoUrl || null

    if (hoaLogoUrl && hoaLogoUrl.startsWith('/uploads/')) {
      const rel = hoaLogoUrl.replace(/^\/uploads\//, '')
      const publicFile = path.join(process.cwd(), 'public', 'uploads', rel)
      try { if (fs.existsSync(publicFile)) fs.unlinkSync(publicFile) } catch (e) { /* ignore */ }
    }

    await prisma.systemConfig.upsert({ where: { id: 'system' }, update: { hoaLogoUrl: null }, create: { id: 'system' } })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    logError('Delete logo error:', err)
    return NextResponse.json({ error: 'Failed to remove logo' }, { status: 500 })
  }
}
