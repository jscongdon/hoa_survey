import { prisma } from '@/lib/prisma'
import { log, error as logError } from '@/lib/logger'

/**
 * Get the appropriate application URL for the current environment.
 * Priority order:
 * 1. Database appUrl (if set and not localhost in production)
 * 2. Environment variables (PRODUCTION_URL or DEVELOPMENT_URL)
 * 3. Fallback defaults
 *
 * In production, localhost URLs from database are ignored to prevent
 * emails from containing localhost links in deployed environments.
 */
export async function getAppUrl(): Promise<string> {
  const sys = await prisma.systemConfig.findUnique({
    where: { id: "system" },
  })

  const isDevelopment = process.env.NODE_ENV === "development"
  let appUrl: string | undefined = sys?.appUrl || undefined

  // In production, don't use localhost URLs even if stored in database
  if (!isDevelopment && appUrl && (appUrl.includes('localhost') || appUrl.includes('127.0.0.1'))) {
    log("[APP-URL] Ignoring localhost appUrl in production:", appUrl)
    appUrl = undefined
  }

  if (!appUrl) {
    if (isDevelopment) {
      appUrl = process.env.DEVELOPMENT_URL || "http://localhost:3000"
    } else {
      appUrl = process.env.PRODUCTION_URL || ""
      if (!appUrl) {
        throw new Error("Production URL not configured. Set PRODUCTION_URL environment variable or configure Application URL in admin settings.")
      }
    }
  }

  log("[APP-URL] Resolved appUrl:", appUrl, "NODE_ENV:", process.env.NODE_ENV, "db_appUrl:", sys?.appUrl, "PRODUCTION_URL:", process.env.PRODUCTION_URL)
  return appUrl
}

/**
 * Get the base URL for email links, ensuring it's never localhost in production.
 * This is a synchronous version that throws if URL cannot be determined.
 */
export async function getBaseUrl(): Promise<string> {
  try {
    return await getAppUrl()
  } catch (error) {
    log("[BASE-URL] Failed to get app URL for email:", error)
    throw error
  }
}