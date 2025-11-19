import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { sendEmail, generateBaseEmail } from "@/lib/email/send";
import { log, error as logError } from "@/lib/logger";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth (middleware may supply x-admin-id header)
    let adminId = req.headers.get("x-admin-id");
    if (!adminId) {
      const token = req.cookies.get("auth-token")?.value;
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const payload = await verifyToken(token as string);
      if (!payload?.adminId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      adminId = payload.adminId;
    }

    const { id } = await params;

    const survey = await prisma.survey.findUnique({
      where: { id },
      include: { memberList: true },
    });
    if (!survey)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (survey.initialSentAt) {
      return NextResponse.json(
        { error: "Initial notice already sent" },
        { status: 409 }
      );
    }

    // Load responses and member info
    const responses = await prisma.response.findMany({
      where: { surveyId: id },
      include: { member: true },
    });

    // Determine base URL
    const isDevelopment = process.env.NODE_ENV === "development";
    const baseUrl = isDevelopment
      ? process.env.DEVELOPMENT_URL || "http://localhost:3000"
      : process.env.PRODUCTION_URL || "";

    // Send email to each response/member (do sequentially to avoid spamming mail server)
    for (const resp of responses) {
      try {
        const surveyUrl = `${baseUrl}/survey/${resp.token}`;
        const html = generateBaseEmail(
          `Survey: ${survey.title}`,
          `<p>Hello ${resp.member.name},</p>`,
          `<p>You are invited to participate in the survey: <strong>${survey.title}</strong>.</p><p>Please click the button below to complete the survey.</p>`,
          { text: "Open Survey", url: surveyUrl }
        );

        await sendEmail({
          to: resp.member.email,
          subject: `Survey: ${survey.title}`,
          html,
        });
      } catch (e) {
        // Log and continue
        log("[SEND_INITIAL] Failed to send to", resp.member.email, e);
      }
    }

    // Mark survey as sent
    await prisma.survey.update({
      where: { id },
      data: { initialSentAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("[SEND_INITIAL]", error);
    return NextResponse.json(
      { error: "Failed to send initial notices" },
      { status: 500 }
    );
  }
}
