import { log, error as logError } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, generateBaseEmail } from "@/lib/email/send";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check if admin exists
    const admin = await prisma.admin.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!admin) {
      return NextResponse.json({
        success: true,
        message:
          "If an account exists with this email, you will receive a password reset link.",
      });
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store token in database
    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        resetToken: token,
        resetTokenExpires: expires,
      },
    });

    log("[FORGOT-PASSWORD] Stored token in DB for email:", admin.email);

    // Get system config for app URL
    const config = await prisma.systemConfig.findUnique({
      where: { id: "system" },
    });
    const isDevelopment = process.env.NODE_ENV === "development";
    let baseUrl: string;
    if (isDevelopment) {
      baseUrl =
        config?.appUrl ||
        process.env.DEVELOPMENT_URL ||
        "http://localhost:3000";
    } else {
      baseUrl = config?.appUrl || process.env.PRODUCTION_URL || "";
      if (!baseUrl) {
        logError("No production URL set for password reset!");
        return NextResponse.json(
          { error: "Production URL not configured" },
          { status: 500 }
        );
      }
    }

    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // Send email
    const bodyHtml = `
      <p>You requested to reset your password. Click the button below to set a new password:</p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this password reset, you can safely ignore this email.</p>
    `;

    const emailHtml = generateBaseEmail(
      "Password Reset Request",
      `Hello ${admin.name || "Admin"},`,
      bodyHtml,
      { text: "Reset Password", url: resetUrl },
      "This is an automated email. Please do not reply directly to this message."
    );

    await sendEmail({
      to: admin.email,
      subject: "Password Reset Request",
      html: emailHtml,
    });

    return NextResponse.json({
      success: true,
      message:
        "If an account exists with this email, you will receive a password reset link.",
    });
  } catch (error) {
    logError("Forgot password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
