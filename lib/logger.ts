// NOTE: don't import `prisma` at module init to avoid opening DB connections
// or executing Prisma client code during build-time or in fragile environments.
// We will dynamically import it when needed.

/**
 * Central structured logger
 * - Exports `log` (alias for info) and `error` for backward compatibility
 * - Exports `debug`, `info`, `warn`, `error`, and `child` for contextual loggers
 * - Honors `LOG_LEVEL` env (debug|info|warn|error) and `NODE_ENV`
 * - In development enables debug by default; in production defaults to info
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const CACHE_DURATION = 60_000; // 1 minute
let cachedLogLevel: LogLevel | null = null;
let lastLogLevelCheck = 0;

async function fetchLogLevelFromDb(): Promise<LogLevel | null> {
  try {
    // Dynamic import to avoid initializing Prisma at module load time
    const mod = await import("./prisma");
    const prismaClient = (mod && (mod.default || mod.prisma || mod)) as any;
    if (!prismaClient || !prismaClient.systemConfig) return null;

    const config: any = await prismaClient.systemConfig.findUnique({
      where: { id: "system" },
    });
    const lv = ((config?.logLevel as string) || "").toLowerCase();
    if (lv === "debug" || lv === "info" || lv === "warn" || lv === "error") {
      return lv as LogLevel;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get configured level: prefer DB `logLevel` if present, then env LOG_LEVEL, then default to info
 */
function getConfiguredLevel(): LogLevel {
  // Prefer cached DB value if fresh
  const now = Date.now();
  if (cachedLogLevel !== null && now - lastLogLevelCheck < CACHE_DURATION) {
    return cachedLogLevel;
  }

  const env = (process.env.LOG_LEVEL || "").toLowerCase();
  if (env === "debug") return "debug";
  if (env === "warn") return "warn";
  if (env === "error") return "error";
  return "info";
}

function shouldLog(level: LogLevel): boolean {
  const configured = getConfiguredLevel();
  if (configured === "debug") return true;
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[configured];
}

function timestamp() {
  return new Date().toISOString();
}

function formatMessage(level: LogLevel, msg: any, context?: Record<string, any>) {
  const base = {
    ts: timestamp(),
    level,
    msg,
    ...(context ? { ctx: context } : {}),
  };
  return base;
}

/**
 * Core logger implementation
 */
function normalizeArgs(args: any[]) {
  let error: Error | undefined;
  const context: Record<string, any> = {};
  const parts: string[] = [];

  for (const a of args) {
    if (a instanceof Error) {
      error = a;
    } else if (a && typeof a === "object") {
      // merge object-like context
      Object.assign(context, a);
    } else {
      parts.push(String(a));
    }
  }

  const msg = parts.join(" ");
  const ctx = Object.keys(context).length ? context : undefined;
  return { msg, ctx, error } as { msg: string; ctx?: Record<string, any>; error?: Error };
}

export function debug(...args: any[]) {
  if (!shouldLog("debug")) return;
  const { msg, ctx, error } = normalizeArgs(args);
  const out = formatMessage("debug", msg || (error ? error.message : ""), ctx);
  if (error) {
    console.debug(JSON.stringify(out), error.stack);
  } else {
    console.debug(JSON.stringify(out));
  }
}

export function info(...args: any[]) {
  if (!shouldLog("info")) return;
  const { msg, ctx, error } = normalizeArgs(args);
  const out = formatMessage("info", msg || (error ? error.message : ""), ctx);
  if (error) {
    console.log(JSON.stringify(out), error.stack);
  } else {
    console.log(JSON.stringify(out));
  }
}

export function warn(...args: any[]) {
  if (!shouldLog("warn")) return;
  const { msg, ctx, error } = normalizeArgs(args);
  const out = formatMessage("warn", msg || (error ? error.message : ""), ctx);
  if (error) {
    console.warn(JSON.stringify(out), error.stack);
  } else {
    console.warn(JSON.stringify(out));
  }
}

export function error(...args: any[]) {
  if (!shouldLog("error")) return;
  const { msg, ctx, error: err } = normalizeArgs(args);
  const out = formatMessage("error", msg || (err ? err.message : ""), ctx);
  if (err) {
    console.error(JSON.stringify(out), err.stack);
  } else {
    console.error(JSON.stringify(out));
  }
}

// Backwards-compatible aliases
export const log = info;
export const logError = error;

/**
 * Create a child logger with bound context (e.g., requestId, adminId)
 */
export function child(boundContext: Record<string, any>) {
  return {
    debug: (m: any, ctx?: Record<string, any>) => debug(m, { ...boundContext, ...(ctx || {}) }),
    info: (m: any, ctx?: Record<string, any>) => info(m, { ...boundContext, ...(ctx || {}) }),
    warn: (m: any, ctx?: Record<string, any>) => warn(m, { ...boundContext, ...(ctx || {}) }),
    error: (m: any, ctx?: Record<string, any>) => error(m, { ...boundContext, ...(ctx || {}) }),
  };
}

// (no-op) previously used development mode checks removed

// Periodically refresh DB-backed log level
async function refreshLogLevel() {
  try {
    const lv = await fetchLogLevelFromDb();
    if (lv) {
      cachedLogLevel = lv;
      lastLogLevelCheck = Date.now();
    }
  } catch (e) {
    // ignore
  } finally {
    setTimeout(() => refreshLogLevel().catch(() => {}), CACHE_DURATION);
  }
}

refreshLogLevel().catch(() => {});

