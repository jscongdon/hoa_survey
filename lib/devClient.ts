let cached: { value: boolean; ts: number } | null = null;
const CACHE_MS = 60 * 1000;

export async function isDevModeClient(): Promise<boolean> {
  // If bundler already set NODE_ENV to development, short-circuit
  // (Next replaces this at build time on the client).
  try {
    // @ts-ignore
    if (process.env.NODE_ENV === "development") return true;
  } catch {}

  const now = Date.now();
  if (cached && now - cached.ts < CACHE_MS) return cached.value;

  try {
    const res = await fetch("/api/setup/status");
    if (!res.ok) {
      cached = { value: false, ts: now };
      return false;
    }
    const data = await res.json();
    const val = Boolean(data.developmentMode);
    cached = { value: val, ts: now };
    return val;
  } catch (err) {
    // On error assume false to avoid noisy logs in production-like env
    cached = { value: false, ts: now };
    return false;
  }
}
