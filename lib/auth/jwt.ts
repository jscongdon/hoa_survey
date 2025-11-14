import { SignJWT, jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-secret'
)
const EXPIRY = process.env.JWT_EXPIRY || '24h'

export interface JWTPayload {
  id?: string
  adminId?: string
  email: string
  role: string
}

export async function signToken(payload: Record<string, any>): Promise<string> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(SECRET)
  return token
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const verified = await jwtVerify(token, SECRET)
    return verified.payload as any as JWTPayload
  } catch {
    return null
  }
}
