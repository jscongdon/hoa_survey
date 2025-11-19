import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { log, error as logError } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, testEmail } =
      body;

    log("[TEST-EMAIL] Received request:", {
      smtpHost,
      smtpPort,
      smtpUser,
      smtpFrom,
      testEmail,
    });

    if (
      !smtpHost ||
      !smtpPort ||
      !smtpUser ||
      !smtpPass ||
      !smtpFrom ||
      !testEmail
    ) {
      log("[TEST-EMAIL] Missing required fields");
      return NextResponse.json(
        { error: "All SMTP fields are required" },
        { status: 400 }
      );
    }

    // Create transporter
    const transportConfig = {
      host: smtpHost,
      port: parseInt(smtpPort.toString()),
      secure: parseInt(smtpPort.toString()) === 465,
      connectionTimeout: 30000, // 30 seconds
      greetingTimeout: 30000,
      socketTimeout: 120000, // 2 minutes for actual sending
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      logger: true, // Enable debug logging
      debug: true,
    };

    log("[TEST-EMAIL] Transport config:", {
      ...transportConfig,
      auth: { user: smtpUser, pass: "***" },
      logger: false,
      debug: false,
    });

    const transporter = nodemailer.createTransport(transportConfig);

    log("[TEST-EMAIL] Verifying connection...");

    try {
      // Verify connection
      await transporter.verify();
      log("[TEST-EMAIL] Connection verified successfully");
    } catch (verifyErr: any) {
      logError("[TEST-EMAIL] Connection verification failed:", verifyErr);
      return NextResponse.json(
        {
          error: "SMTP connection failed",
          details: verifyErr.message,
          code: verifyErr.code,
        },
        { status: 500 }
      );
    }

    log("[TEST-EMAIL] Sending test email...");

    try {
      // Send test email - don't wait for full completion, just fire it off
      const bodyHtml = `
        <p>Your SMTP settings are working correctly.</p>
        <p>You can now proceed with setting up your administrator account.</p>
      `;

      const html = require("@/lib/email/send").generateBaseEmail(
        "Email Configuration Successful!",
        "",
        bodyHtml,
        undefined,
        "This is an automated test email from HOA Survey setup wizard."
      );

      transporter
        .sendMail({
          from: smtpFrom,
          to: testEmail,
          subject: "HOA Survey - Email Configuration Test",
          html,
        })
        .then((info) => {
          log("[TEST-EMAIL] Email sent successfully:", info.messageId);
        })
        .catch((sendErr) => {
          logError("[TEST-EMAIL] Email send failed (async):", sendErr);
        });

      // Return success immediately after queuing
      log("[TEST-EMAIL] Email queued successfully");
    } catch (sendErr: any) {
      logError("[TEST-EMAIL] Email send failed:", sendErr);
      return NextResponse.json(
        {
          error: "Failed to send email",
          details: sendErr.message,
          code: sendErr.code,
        },
        { status: 500 }
      );
    }

    log("[TEST-EMAIL] Success!");

    return NextResponse.json({ success: true });
  } catch (err: any) {
    logError("[TEST-EMAIL] Unexpected error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to send test email", details: err.code },
      { status: 500 }
    );
  }
}
