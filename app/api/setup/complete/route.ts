import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { log, error as logError } from "@/lib/logger";
import { encryptAdminData } from "@/lib/encryption";

export async function POST(req: NextRequest) {
  try {
    log("[SETUP-COMPLETE] Starting setup completion");

    const {
      hoaName,
      hoaLogoUrl,
      appUrl,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      smtpFrom,
      adminEmail,
      adminPassword,
      adminName,
    } = await req.json();

    log("[SETUP-COMPLETE] Received data:", {
      hoaName,
      appUrl,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpFrom,
      adminEmail,
      adminName,
    });

    // Validate required fields
    if (
      !hoaName ||
      !appUrl ||
      !smtpHost ||
      !smtpPort ||
      !smtpUser ||
      !smtpPass ||
      !smtpFrom ||
      !adminEmail ||
      !adminPassword ||
      !adminName
    ) {
      log("[SETUP-COMPLETE] Missing required fields");
      return NextResponse.json(
        { error: "All required fields must be provided" },
        { status: 400 }
      );
    }

    log("[SETUP-COMPLETE] Checking if setup already completed");

    // Check if setup is already complete
    let existingConfig = null;
    try {
      existingConfig = await prisma.systemConfig.findUnique({
        where: { id: "system" },
      });
    } catch (e: any) {
      // If the SystemConfig table doesn't exist (P2021), attempt to create schema in dev
      if (e?.code === "P2021") {
        log("[SETUP-COMPLETE] SystemConfig table missing; running `npx prisma db push` to create schema (dev-only)");
        try {
          // Run prisma db push synchronously to create missing tables (development convenience)
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const cp = require("child_process");
          cp.execSync("npx prisma db push", { stdio: "inherit" });
          // Retry lookup after creating schema
          existingConfig = await prisma.systemConfig.findUnique({
            where: { id: "system" },
          });
        } catch (innerErr) {
          logError("[SETUP-COMPLETE] Failed to create schema:", innerErr);
          throw innerErr;
        }
      } else {
        throw e;
      }
    }

    if (existingConfig?.setupCompleted) {
      log("[SETUP-COMPLETE] Setup already completed");
      return NextResponse.json(
        { error: "Setup has already been completed" },
        { status: 400 }
      );
    }

    log("[SETUP-COMPLETE] Checking if admin exists");

    // Check if admin already exists (need to check both plain text and encrypted emails for backward compatibility)
    let existingAdmin = await prisma.admin.findUnique({
      where: { email: adminEmail },
    });

    let adminExists = !!existingAdmin;

    if (adminExists) {
      log("[SETUP-COMPLETE] Admin already exists");
      return NextResponse.json(
        { error: "An admin account with this email already exists" },
        { status: 400 }
      );
    }

    log("[SETUP-COMPLETE] Generating secrets");

    // Generate verification token (JWT secret should be set via environment variable)
    const verificationToken = crypto.randomBytes(32).toString("hex");

    log("[SETUP-COMPLETE] Hashing password");

    // Hash admin password
    const hashedPassword = await hashPassword(adminPassword);

    log("[SETUP-COMPLETE] Saving to database");

    // Create system config and admin in transaction
    await prisma.$transaction(async (tx) => {
      // Create or update system config (but don't mark as completed yet)
      await tx.systemConfig.upsert({
        where: { id: "system" },
        create: {
          id: "system",
          setupCompleted: false, // Will be set to true after email verification
          hoaName,
          hoaLogoUrl: hoaLogoUrl || null,
          smtpHost,
          smtpPort,
          smtpUser,
          smtpPass,
          smtpFrom,
          appUrl, // Use the provided appUrl
        },
        update: {
          hoaName,
          hoaLogoUrl: hoaLogoUrl || null,
          smtpHost,
          smtpPort,
          smtpUser,
          smtpPass,
          smtpFrom,
          appUrl, // Update appUrl as well
        },
      });

      // Create admin account (initially with LIMITED role, will be upgraded after verification)
      const encryptedAdminData = await encryptAdminData({
        email: adminEmail,
        name: adminName,
      });
      await tx.admin.create({
        data: {
          email: encryptedAdminData.email,
          password: hashedPassword,
          name: encryptedAdminData.name,
          role: "LIMITED", // Will be changed to FULL after email verification
          verificationToken,
          verificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });

      // Store verification token (we'll add this to Admin model)
      // For now, we'll use a simple approach and send the token directly
    });

    log("[SETUP-COMPLETE] Database updated, sending verification email");

    log("[SETUP-COMPLETE] Using appUrl for verification:", appUrl);

    try {
      // Send verification email
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        connectionTimeout: 30000, // 30 seconds
        greetingTimeout: 30000,
        socketTimeout: 120000, // 2 minutes for actual sending
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        logger: true,
        debug: true,
      });

      const verificationUrl = `${appUrl}/api/setup/verify?token=${verificationToken}&email=${encodeURIComponent(adminEmail)}`;

      const bodyHtml = `
        <p>Your administrator account has been created successfully.</p>
        <p>Please verify your email address to activate your account and gain full administrator access:</p>
        <p style="color: #6b7280; font-size: 14px;">
          Or copy and paste this link into your browser:<br>
          <a href="${verificationUrl}" style="color: #2563eb;">${verificationUrl}</a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          If you didn't request this, please ignore this email.
        </p>
      `;

      const html = require("@/lib/email/send").generateBaseEmail(
        `Welcome to ${hoaName}!`,
        "",
        bodyHtml,
        { text: "Verify Email Address", url: verificationUrl },
        ""
      );

      // Send email asynchronously to avoid timeout
      transporter
        .sendMail({
          from: smtpFrom,
          to: adminEmail,
          subject: `${hoaName} - Verify Your Administrator Account`,
          html,
        })
        .then((info) => {
          log("[SETUP-COMPLETE] Verification email sent:", info.messageId);
        })
        .catch((emailErr) => {
          logError(
            "[SETUP-COMPLETE] Failed to send verification email:",
            emailErr
          );
        });
    } catch (emailError: any) {
      logError("[SETUP-COMPLETE] Email setup error:", emailError);
      // Don't fail the whole process if email fails
    }

    log("[SETUP-COMPLETE] Storing verification token");

    // Store the verification token temporarily (in memory for this session)
    // In production, you'd want to store this in the database with an expiry
    global.pendingVerifications = global.pendingVerifications || new Map();
    global.pendingVerifications.set(verificationToken, {
      email: adminEmail,
      expires: Date.now() + 3600000, // 1 hour
    });

    log("[SETUP-COMPLETE] Setup completed successfully");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logError("[SETUP-COMPLETE] Error:", error);
    return NextResponse.json(
      { error: error.message || "Setup failed" },
      { status: 500 }
    );
  }
}
