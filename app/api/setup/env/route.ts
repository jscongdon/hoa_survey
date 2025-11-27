import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Only allow in development mode
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 }
    );
  }

  // Return setup environment variables for pre-populating the wizard
  const setupVars = {
    hoaName: process.env.HOA_NAME || "",
    hoaLogoUrl: process.env.HOA_LOGO_URL || "",
    appUrl: process.env.APP_URL || "",
    smtpHost: process.env.SMTP_HOST || "",
    smtpPort: process.env.SMTP_PORT || "587",
    smtpUser: process.env.SMTP_USER || "",
    smtpPass: process.env.SMTP_PASS || "",
    smtpFrom: process.env.SMTP_FROM || "",
    adminEmail: process.env.ADMIN_EMAIL || "",
    adminPassword: process.env.ADMIN_PASSWORD || "",
    adminName: process.env.ADMIN_NAME || "",
    testEmail: process.env.TEST_EMAIL || "",
  };

  return NextResponse.json(setupVars);
}
