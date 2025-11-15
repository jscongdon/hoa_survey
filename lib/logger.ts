import prisma from './prisma'

let cachedDevMode: boolean | null = null
let lastCheck = 0
const CACHE_DURATION = 60000 // Cache for 1 minute

export async function isDevelopmentMode(): Promise<boolean> {
  // During setup, always enable dev mode
  if (process.env.NODE_ENV === 'development') {
    return true
  }

  // Check cache
  const now = Date.now()
  if (cachedDevMode !== null && now - lastCheck < CACHE_DURATION) {
    return cachedDevMode
  }

  try {
    const config = await prisma.systemConfig.findUnique({
      where: { id: 'system' },
      select: { developmentMode: true }
    })
    
    cachedDevMode = config?.developmentMode ?? true
    lastCheck = now
    return cachedDevMode
  } catch {
    // If database not ready, default to true during setup
    return true
  }
}

export async function log(message: string, data?: any) {
  const devMode = await isDevelopmentMode()
  if (devMode) {
    if (data) {
      console.log(message, data)
    } else {
      console.log(message)
    }
  }
}

export async function error(message: string, err?: any) {
  // Always log errors
  if (err) {
    console.error(message, err)
  } else {
    console.error(message)
  }
}
