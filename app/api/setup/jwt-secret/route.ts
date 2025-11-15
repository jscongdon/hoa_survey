import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    // Get system config
    const config = await prisma.systemConfig.findUnique({
      where: { id: 'system' },
      select: { jwtSecret: true, setupCompleted: true }
    })

    if (!config?.jwtSecret) {
      return NextResponse.json({ error: 'JWT secret not found' }, { status: 404 })
    }

    // Return the JWT secret (only accessible after setup)
    return NextResponse.json({ 
      jwtSecret: config.jwtSecret,
      setupCompleted: config.setupCompleted,
      instructions: 'Add this as JWT_SECRET environment variable in your Portainer stack configuration'
    })
  } catch (error: any) {
    console.error('Error fetching JWT secret:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve JWT secret' },
      { status: 500 }
    )
  }
}
