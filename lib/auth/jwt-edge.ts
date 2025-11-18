

export interface JWTPayload {
  id?: string;
  adminId?: string;
  email: string;
  role: string;
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === 'dev-secret-change-in-production') {
      if (process.env.NODE_ENV === 'development') {
        console.log('[JWT-EDGE] JWT_SECRET not configured, skipping middleware verification');
      }
      return { email: '', role: 'LIMITED', adminId: '' };
    }

    // Edge-compatible JWT verification (HS256 only)
    const [headerB64, payloadB64, signatureB64] = token.split('.')
    if (!headerB64 || !payloadB64 || !signatureB64) return null;

    // Decode header and payload
    const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (header.alg !== 'HS256') return null;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    // Verify signature
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
      encoder.encode(`${headerB64}.${payloadB64}`)
    );
    if (!valid) return null;
    // Decode payload
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    return payload as JWTPayload;
  } catch (error) {
    console.error('[JWT-EDGE] Token verification failed:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}
