import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './lib/auth/jwt-edge'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Always allow API and static assets
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico')
  ) {
    return NextResponse.next()
  }

  // For /setup page, check if setup is complete via API
  if (pathname === '/setup') {
    try {
      const setupStatusUrl = new URL('/api/setup/status', request.url)
      const response = await fetch(setupStatusUrl)
      const data = await response.json()
      
      if (data.setupCompleted) {
        return NextResponse.redirect(new URL('/login', request.url))
      }
      return NextResponse.next()
    } catch (error) {
      // Allow setup page on error
      return NextResponse.next()
    }
  }

  // For other routes, check setup status
  try {
    const setupStatusUrl = new URL('/api/setup/status', request.url)
    const response = await fetch(setupStatusUrl)
    const data = await response.json()

    if (!data.setupCompleted && !data.adminExists) {
      // No setup, redirect to setup
      return NextResponse.redirect(new URL('/setup', request.url))
    } else if (!data.setupCompleted && data.adminExists) {
      // Admin exists but not verified, allow login only
      if (pathname !== '/login' && !pathname.startsWith('/survey/')) {
        return NextResponse.redirect(new URL('/login?pending=verification', request.url))
      }
      return NextResponse.next()
    }
  } catch (error) {
    // On error, redirect to setup unless already there
    if (pathname !== '/setup') {
      return NextResponse.redirect(new URL('/setup', request.url))
    }
    return NextResponse.next()
  }

  const token = request.cookies.get('auth-token')?.value

  // Public routes
  if (
    pathname.startsWith('/survey/') ||
    pathname === '/login' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password'
  ) {
    return NextResponse.next()
  }

  // Protected routes require token
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const payload = await verifyToken(token)
  if (!payload) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Add admin info to headers for API routes (safe coerce to string)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-admin-id', payload.adminId || '')
  requestHeaders.set('x-admin-role', payload.role || '')

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
