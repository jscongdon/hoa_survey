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
    const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production'
    const SECRET = new TextEncoder().encode(secret)
    const verified = await jwtVerify(token, SECRET)
    return verified.payload as any as JWTPayload
  } catch (error) {
    console.error('[JWT] Token verification failed:', error instanceof Error ? error.message : 'Unknown error')
    return null
  }
}
