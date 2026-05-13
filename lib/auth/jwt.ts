import { SignJWT, jwtVerify } from "jose";
import { log, error as logError } from "@/lib/logger";

// Helper to detect if we're in Edge Runtime
function isEdgeRuntime(): boolean {
  return process.env.NEXT_RUNTIME === "edge";
}

async function getJWTSecret(): Promise<string> {
  // Always use environment variable for JWT secret
  const envSecret = process.env.JWT_SECRET;

  if (
    envSecret &&
    envSecret !== "dev-secret-will-be-replaced-by-setup" &&
    envSecret.length > 0
  ) {
    log("[JWT] Using JWT_SECRET from environment, length:", envSecret.length);
    return envSecret;
  }

  // Fallback for development
  logError("[JWT] No valid JWT_SECRET in environment, using fallback!");
  return "dev-secret-change-in-production";
}

const EXPIRY = "24h";

export interface JWTPayload {
  id?: string;
  adminId?: string;
  email: string;
  role: string;
}

export async function signToken(payload: Record<string, any>): Promise<string> {
  const secret = await getJWTSecret();
  const SECRET = new TextEncoder().encode(secret);

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(SECRET);
  return token;
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const secret = await getJWTSecret();
    const SECRET = new TextEncoder().encode(secret);
    const verified = await jwtVerify(token, SECRET);
    return verified.payload as any as JWTPayload;
  } catch (error) {
    logError(
      "[JWT] Token verification failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return null;
  }
}
