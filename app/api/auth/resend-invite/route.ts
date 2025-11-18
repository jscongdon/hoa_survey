import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
import crypto from "crypto";
import { verifyToken } from "@/lib/auth/jwt";
import { log } from "@/lib/logger";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { adminId } = body;

    // Verify requester token from Authorization header OR Cookie header (auth-token)
    // Clients cannot read HttpOnly cookies, so browser code may send the token
    // in an Authorization header. For server-side callers the cookie will be
    // present on the request; parse it as a fallback.
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

    // Generate new token and expiry
    const tokenStr = crypto.randomBytes(32).toString("hex");
    const expiryDays = parseInt(process.env.INVITE_EXPIRY_DAYS || "7", 10);
    const expiry = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    await prisma.admin.update({
      where: { id: adminId },
      data: { secret2FA: tokenStr, inviteExpires: expiry },
    });

    // Build appUrl similar to invite flow
    const sys = await prisma.systemConfig.findUnique({
      where: { id: "system" },
    });
    let appUrl: string | undefined = sys?.appUrl || undefined;
    if (!appUrl) {
      if (process.env.NODE_ENV === "development") {
        appUrl = process.env.DEVELOPMENT_URL || "http://localhost:3000";
      } else {
        appUrl = process.env.PRODUCTION_URL || "";
        if (!appUrl) {
          return NextResponse.json(
            { error: "Production URL not configured" },
            { status: 500 }
          );
        }
      }
    }

    const inviteUrl = `${appUrl.replace(/\/$/, "")}/invite/${tokenStr}`;
    log(
      `[RESEND_INVITE] Generated invite URL: ${inviteUrl} (resender=${requester.id}) expires=${expiry.toISOString()}`
    );
    await sendEmail({
      to: admin.email,
      subject: "HOA Survey Admin Invite (Resent)",
      html: `<p>Your admin invite was resent. Click <a href="${inviteUrl}">here</a> to set your password and activate your account.</p><p>This invite will expire on ${expiry.toISOString()}.</p>`,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[resend-invite] error:", err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
