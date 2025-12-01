import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { id: 'system' }
    })

    const adminCount = await prisma.admin.count()

    // Temporary debug logging to help diagnose mismatch between DB contents
    // and API responses in deployed environments. Remove after debugging.
    try {
      console.log('DEBUG /api/setup/status config:', JSON.stringify(config))
      console.log('DEBUG /api/setup/status adminCount:', adminCount)
    } catch (e) {
      // Swallow logging errors to avoid affecting response
      console.error('DEBUG /api/setup/status log error', e)
    }

    return NextResponse.json({
      setupCompleted: config?.setupCompleted || false,
      adminExists: adminCount > 0,
      developmentMode: config?.developmentMode ?? false,
    })
  } catch (error) {
    return NextResponse.json({
      setupCompleted: false,
      adminExists: false
    })
  }
}
