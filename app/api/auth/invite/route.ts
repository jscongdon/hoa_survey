import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, generateBaseEmail } from "@/lib/email/send";
import { signToken } from "@/lib/auth/jwt";
import crypto from "crypto";
import { log } from "@/lib/logger";
import { getBaseUrl } from "@/lib/app-url";
import { encryptAdminData } from "@/lib/encryption";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, name, invitedById, role } = body;
    // Only allow if current user is FULL admin (should check JWT in real app)
    const inviter = await prisma.admin.findUnique({
      where: { id: invitedById },
    });
    if (!inviter || inviter.role !== "FULL") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    // Generate invite token
    const token = crypto.randomBytes(32).toString("hex");
    // Store as a pending admin with invite token and expiry
    const expiryDays = parseInt(process.env.INVITE_EXPIRY_DAYS || "7", 10);
    const expiry = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    // Encrypt sensitive admin data
    const encryptedData = await encryptAdminData({ email, name });

    const admin = await prisma.admin.create({
      data: {
        email: encryptedData.email,
        name: encryptedData.name,
        password: "",
        role: role || "VIEW_ONLY",
        invitedById,
        secret2FA: token, // store token in secret2FA until accepted
        inviteExpires: expiry,
      },
    });
    // Send invite email
    let appUrl: string;
    try {
      appUrl = await getBaseUrl();
    } catch (error) {
      log("[INVITE] Failed to get app URL:", error);
      return NextResponse.json(
        { error: "Application URL not configured" },
        { status: 500 }
      );
    }
    const inviteUrl = `${appUrl.replace(/\/$/, "")}/invite/${token}`;
    log(
      `[INVITE] Generated invite URL: ${inviteUrl} (inviter=${invitedById}) expires=${expiry.toISOString()}`
    );
    // Fetch system config for HOA name
    const sys = await prisma.systemConfig.findUnique({
      where: { id: "system" },
    });
    const bodyHtml = `
      <p>You have been invited as an admin for <strong>${sys?.hoaName || "your HOA"}</strong>.</p>
      <p>This invite will expire on ${expiry.toISOString()}.</p>
    `;

    const html = generateBaseEmail(
      "Administrator Invitation",
      `<p>Hello ${name || ""},</p>`,
      bodyHtml,
      { text: "Accept Invitation", url: inviteUrl },
      `This invite expires on ${expiry.toISOString()}.`
    );

    await sendEmail({
      to: email,
      subject: "HOA Survey Admin Invite",
      html,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
