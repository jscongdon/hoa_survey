import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import nodemailer from "nodemailer";
import { generateBaseEmail } from "@/lib/email/send";
import crypto from "crypto";
import { log, error as logError } from "@/lib/logger";
import { getBaseUrl } from "@/lib/app-url";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    log("[RESEND-VERIFICATION] Request for:", email);

    // Check if admin exists and is unverified
    const admin = await prisma.admin.findUnique({
      where: { email },
    });

    if (!admin) {
      return NextResponse.json(
        { error: "Admin account not found" },
        { status: 404 }
      );
    }

    if (admin.role !== "LIMITED") {
      return NextResponse.json(
        { error: "Account is already verified" },
        { status: 400 }
      );
    }

    // Get system config for SMTP settings
    const config = await prisma.systemConfig.findUnique({
      where: { id: "system" },
    });

    if (!config || !config.smtpHost || !config.smtpUser || !config.smtpPass) {
      logError("[RESEND-VERIFICATION] SMTP not configured");
      return NextResponse.json(
        { error: "Email system not configured" },
        { status: 500 }
      );
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    log("[RESEND-VERIFICATION] Sending verification email");

    // Send verification email asynchronously
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort || 587,
      secure: config.smtpPort === 465,
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 120000,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
      logger: true,
      debug: true,
    });

    let appUrl: string;
    try {
      appUrl = await getBaseUrl();
    } catch (error) {
      logError("[RESEND-VERIFICATION] Failed to get app URL:", error);
      return NextResponse.json(
        { error: "Application URL not configured" },
        { status: 500 }
      );
    }
    const verificationUrl = `${appUrl}/api/setup/verify?token=${verificationToken}&email=${encodeURIComponent(email)}`;

    const bodyHtml = `
      <p>Click the button below to verify your administrator account:</p>
      <p style="color: #6b7280; font-size: 14px;">
        Or copy and paste this link into your browser:<br>
        <a href="${verificationUrl}" style="color: #2563eb;">${verificationUrl}</a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">
        If you didn't request this, please ignore this email.
      </p>
    `;

    const html = generateBaseEmail(
      "Verify Your Account",
      "",
      bodyHtml,
      { text: "Verify Email Address", url: verificationUrl },
      `${config.hoaName} — verification email`
    );

    transporter
      .sendMail({
        from: config.smtpFrom || config.smtpUser,
        to: email,
        subject: `${config.hoaName} - Verify Your Administrator Account`,
        html,
      })
      .then((info) => {
        log("[RESEND-VERIFICATION] Email sent:", info.messageId);
      })
      .catch((emailErr) => {
        logError("[RESEND-VERIFICATION] Failed to send email:", emailErr);
      });

    // Store verification token
    global.pendingVerifications = global.pendingVerifications || new Map();
    global.pendingVerifications.set(verificationToken, {
      email,
      expires: Date.now() + 3600000, // 1 hour
    });

    log("[RESEND-VERIFICATION] Verification email queued");

    return NextResponse.json({
      success: true,
      message: "Verification email sent. Please check your inbox.",
    });
  } catch (error: any) {
    logError("[RESEND-VERIFICATION] Error:", error);
    return NextResponse.json(
      { error: "Failed to send verification email" },
      { status: 500 }
    );
  }
}
