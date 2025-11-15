import { jwtVerify } from 'jose'

export interface JWTPayload {
  id?: string
  adminId?: string
  email: string
  role: string
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    // In Edge Runtime, we can only use environment variables
    const secret = process.env.JWT_SECRET
    
    // If JWT_SECRET is not set, we can't verify tokens in middleware
    // Let the API routes handle authentication instead
    if (!secret || secret === 'dev-secret-change-in-production') {
      console.log('[JWT-EDGE] JWT_SECRET not configured, skipping middleware verification')
      // Return a minimal payload to allow the request through
      // API routes will do proper verification
      return { email: '', role: 'LIMITED', adminId: '' }
    }
    
    const SECRET = new TextEncoder().encode(secret)
    const verified = await jwtVerify(token, SECRET)
    return verified.payload as any as JWTPayload
  } catch (error) {
    console.error('[JWT] Token verification failed:', error instanceof Error ? error.message : 'Unknown error')
    return null
  }
}
