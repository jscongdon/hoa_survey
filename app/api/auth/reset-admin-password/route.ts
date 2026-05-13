import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, generateBaseEmail } from "@/lib/email/send";
import crypto from "crypto";
import { verifyToken } from "@/lib/auth/jwt";
import { log } from "@/lib/logger";
import { getBaseUrl } from "@/lib/app-url";
import { decryptAdminData } from "@/lib/encryption";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { adminId } = body;

    // Verify requester token from Authorization header OR Cookie header (auth-token)
    const authHeader = (req.headers.get("authorization") || "").replace(
      /^Bearer\s+/i,
      ""
    );
    let token = authHeader || "";
    if (!token) {
      const cookieHeader = req.headers.get("cookie") || "";
      const match = cookieHeader
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith("auth-token="));
      if (match) token = match.split("=")[1];
    }
    const payload = token ? await verifyToken(token) : null;
    if (!payload?.adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure requester is FULL admin
    const requester = await prisma.admin.findUnique({
      where: { id: payload.adminId },
    });
    if (!requester || requester.role !== "FULL") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Fetch target admin
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin)
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });

    // Decrypt admin data for email sending
    const decryptedData = await decryptAdminData({
      name: admin.name || "",
      email: admin.email,
    });

    // Generate reset token and expiry
    const tokenStr = crypto.randomBytes(32).toString("hex");
    const expiryHours = parseInt(
      process.env.RESET_TOKEN_EXPIRY_HOURS || "24",
      10
    );
    const expiry = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    // Clear the password (set to empty string) and set reset token fields
    await prisma.admin.update({
      where: { id: adminId },
      data: {
        password: "",
        resetToken: tokenStr,
        resetTokenExpires: expiry,
      },
    });

    // Determine app URL
    let appUrl: string;
    try {
      appUrl = await getBaseUrl();
    } catch (error) {
      log("[RESET-ADMIN-PASSWORD] Failed to get app URL:", error);
      return NextResponse.json(
        { error: "Application URL not configured" },
        { status: 500 }
      );
    }

    const resetUrl = `${appUrl.replace(/\/$/, "")}/reset-password?token=${tokenStr}`;
    log(
      `[RESET_ADMIN_PW] Generated reset URL: ${resetUrl} (requestedBy=${requester.id}) expires=${expiry.toISOString()}`
    );

    const bodyHtml = `
      <p>An administrator has requested a password reset for your account.</p>
      <p>This link will expire on ${expiry.toISOString()}.</p>
    `;

    const html = generateBaseEmail(
      "Password Reset Request",
      `<p>Hello ${decryptedData.name || ""},</p>`,
      bodyHtml,
      { text: "Reset Password", url: resetUrl },
      `This link will expire on ${expiry.toISOString()}.`
    );

    await sendEmail({
      to: decryptedData.email,
      subject: "HOA Survey — Reset Your Admin Password",
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[reset-admin-password] error:", err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
