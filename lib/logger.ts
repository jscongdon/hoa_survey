import prisma from "./prisma";

let cachedDevMode: boolean | null = null;
let lastCheck = 0;
const CACHE_DURATION = 60000; // Cache for 1 minute

async function isDevelopmentMode(): Promise<boolean> {
  // Honor explicit LOG_LEVEL for temporary verbose logging
  const envLogLevel = (process.env.LOG_LEVEL || "").toLowerCase();
  if (envLogLevel === "debug") {
    return true;
  }

  // During setup, always enable dev mode
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  // Check cache
  const now = Date.now();
  if (cachedDevMode !== null && now - lastCheck < CACHE_DURATION) {
    return cachedDevMode;
  }

  try {
    const config = await prisma.systemConfig.findUnique({
      where: { id: "system" },
      select: { developmentMode: true },
    });

    cachedDevMode = config?.developmentMode ?? true;
    lastCheck = now;
    return cachedDevMode;
  } catch {
    // If database not ready, default to true during setup
    return true;
  }
}

export function log(message: string, ...args: any[]) {
  // Use sync check - check cached value or assume true
  const envLogLevel = (process.env.LOG_LEVEL || "").toLowerCase();
  const devMode = envLogLevel === "debug" || (cachedDevMode ?? true);
  if (devMode) {
    if (args.length > 0) {
      console.log(message, ...args);
    } else {
      console.log(message);
    }
  }

  // Refresh cache in background
  isDevelopmentMode().catch(() => {});
}

export function error(message: string | unknown, ...args: any[]) {
  // Always log errors
  if (typeof message !== "string") {
    // If message is actually an error object
    console.error("Error:", message);
  } else if (args.length > 0) {
    console.error(message, ...args);
  } else {
    console.error(message);
  }
}
