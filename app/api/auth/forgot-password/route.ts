import { log, error as logError } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, generateBaseEmail } from "@/lib/email/send";
import crypto from "crypto";
import { getBaseUrl } from "@/lib/app-url";
import { encryptAdminData, decryptAdminData } from "@/lib/encryption";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check if admin exists (check both plain text and encrypted emails for backward compatibility)
    let admin = await prisma.admin.findUnique({ where: { email } });

    let adminExists = !!admin;

    // If not found with plain text, check encrypted version
    if (!adminExists) {
      const encryptedEmailData = await encryptAdminData({ email, name: "" });
      const allAdmins = await prisma.admin.findMany({
        select: { email: true },
      });
      adminExists = allAdmins.some((a) => a.email === encryptedEmailData.email);

      // If encrypted admin exists, fetch the full admin record
      if (adminExists) {
        admin = await prisma.admin.findFirst({
          where: { email: encryptedEmailData.email },
        });
      }
    }

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

    // Decrypt admin data for email sending
    const decryptedData = await decryptAdminData({
      name: admin.name || "",
      email: admin.email,
    });

    // Get the appropriate app URL for email links
    let baseUrl: string;
    try {
      baseUrl = await getBaseUrl();
    } catch (error) {
      logError("Failed to get app URL for password reset:", error);
      return NextResponse.json(
        { error: "Application URL not configured" },
        { status: 500 }
      );
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
      `Hello ${decryptedData.name || "Admin"},`,
      bodyHtml,
      { text: "Reset Password", url: resetUrl },
      "This is an automated email. Please do not reply directly to this message."
    );

    await sendEmail({
      to: decryptedData.email,
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
