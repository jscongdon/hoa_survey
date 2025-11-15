import { SignJWT, jwtVerify } from 'jose'

// Single shared cache for JWT secret
let cachedSecret: string | null = null
let secretPromise: Promise<string> | null = null

// Helper to detect if we're in Edge Runtime
function isEdgeRuntime(): boolean {
  return process.env.NEXT_RUNTIME === 'edge'
}

async function getJWTSecret(): Promise<string> {
  // In Edge Runtime (middleware), we MUST use environment variable
  if (isEdgeRuntime()) {
    const envSecret = process.env.JWT_SECRET
    if (envSecret && envSecret !== 'dev-secret-will-be-replaced-by-setup' && envSecret.length > 0) {
      return envSecret
    }
    console.error('[JWT] Edge Runtime but no valid JWT_SECRET in environment!')
    return 'dev-secret-change-in-production'
  }

  // In Node.js Runtime (API routes), prefer database over env var
  // If we have a cached secret, use it
  if (cachedSecret) {
    console.log('[JWT] Using cached secret from database, length:', cachedSecret.length)
    return cachedSecret
  }

  // If a fetch is already in progress, wait for it
  if (secretPromise) {
    console.log('[JWT] Waiting for in-progress database fetch')
    return secretPromise
  }

  // Start a new fetch - try database (for API routes that can use Prisma)
  secretPromise = (async () => {
    try {
      // Lazy load prisma only in Node.js runtime
      const { default: prisma } = await import('@/lib/prisma')
      
      const config = await prisma.systemConfig.findUnique({
        where: { id: 'system' }
      })

      if (config?.jwtSecret) {
        console.log('[JWT] Loaded secret from database successfully, length:', config.jwtSecret.length)
        cachedSecret = config.jwtSecret
        return config.jwtSecret
      }
      
      console.log('[JWT] No config found in database, using fallback')
    } catch (error) {
      console.error('[JWT] Failed to load secret from database:', error)
    }

    // Fallback to dev secret (should only happen before setup)
    const fallbackSecret = 'dev-secret-change-in-production'
    cachedSecret = fallbackSecret
    return fallbackSecret
  })()

  try {
    return await secretPromise
  } finally {
    secretPromise = null
  }
}

const EXPIRY = '24h'

export interface JWTPayload {
  id?: string
  adminId?: string
  email: string
  role: string
}

export async function signToken(payload: Record<string, any>): Promise<string> {
  const secret = await getJWTSecret()
  const SECRET = new TextEncoder().encode(secret)
  
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(SECRET)
  return token
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const secret = await getJWTSecret()
    const SECRET = new TextEncoder().encode(secret)
    const verified = await jwtVerify(token, SECRET)
    return verified.payload as any as JWTPayload
  } catch (error) {
    console.error('[JWT] Token verification failed:', error instanceof Error ? error.message : 'Unknown error')
    return null
  }
}
