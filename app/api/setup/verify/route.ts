import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    const email = searchParams.get('email')

    if (!token || !email) {
      return NextResponse.redirect(new URL('/setup?error=invalid-link', req.url))
    }

    // Check verification token
    const pendingVerifications = (global as any).pendingVerifications || new Map()
    const verification = pendingVerifications.get(token)

    if (!verification || verification.email !== email) {
      return NextResponse.redirect(new URL('/setup?error=invalid-token', req.url))
    }

    if (Date.now() > verification.expires) {
      pendingVerifications.delete(token)
      return NextResponse.redirect(new URL('/setup?error=expired-token', req.url))
    }

    // Update admin role to FULL and mark setup as complete
    await prisma.$transaction(async (tx) => {
      await tx.admin.update({
        where: { email },
        data: { role: 'FULL' }
      })

      await tx.systemConfig.update({
        where: { id: 'system' },
        data: { setupCompleted: true }
      })
    })

    // Clean up verification token
    pendingVerifications.delete(token)

    // Trigger container restart to reload JWT secret from database
    // This is done asynchronously and doesn't block the redirect
    fetch(new URL('/api/settings/restart', req.url).toString(), {
      method: 'POST',
      headers: {
        'x-setup-restart': 'true'
      }
    }).catch(err => console.error('Failed to trigger restart:', err))

    // Redirect to login with success message
    return NextResponse.redirect(new URL('/login?verified=true', req.url))
  } catch (error: any) {
    console.error('Verification error:', error)
    return NextResponse.redirect(new URL('/setup?error=verification-failed', req.url))
  }
}
