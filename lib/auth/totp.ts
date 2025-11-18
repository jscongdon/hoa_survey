import { totp, authenticator } from "otplib";

export function generateTwoFactorSecret(email: string): string {
  return authenticator.generateSecret() as string;
}

export function verifyTwoFactorToken(secret: string, token: string): boolean {
  return totp.check(token, secret);
}

export function getTwoFactorQRCode(secret: string, email: string): string {
  return authenticator.keyuri(email, "HOA Survey", secret);
}
