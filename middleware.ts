import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './lib/auth/jwt'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value
  const pathname = request.nextUrl.pathname

  // Public routes
  if (
    pathname.startsWith('/survey/') ||
    pathname === '/login'
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
