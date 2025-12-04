import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { sendBulkEmails, sendEmail, generateBaseEmail } from "@/lib/email/send";
import { getBaseUrl } from "@/lib/app-url";
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

    // Determine base URL for links
    const baseUrl = await getBaseUrl();

    // Bulk send initial notices in batches
    const emailItems = responses.map((resp) => ({
      options: {
        to: resp.member.email,
        subject: `Survey: ${survey.title}`,
        html: generateBaseEmail(
          `Survey: ${survey.title}`,
          `<p>Hello ${resp.member.name},</p>`,
          `<p>You are invited to participate in the survey: <strong>${survey.title}</strong>.</p><p>Please click the button below to complete the survey.</p>`,
          { text: "Open Survey", url: `${baseUrl}/survey/${resp.token}` }
        ),
      },
      meta: { memberId: resp.memberId, email: resp.member.email },
    }));

    let results = [] as any[];
    if (typeof sendBulkEmails === "function") {
      results = await sendBulkEmails(emailItems, { batchSize: 50, delayMsBetweenBatches: 1000, retryCount: 1, retryDelayMs: 500 });
    } else {
      // Fallback sequential send
      for (const it of emailItems) {
        try {
          await sendEmail(it.options);
          results.push({ to: it.options.to, ok: true });
        } catch (e) {
          results.push({ to: it.options.to, ok: false, error: String(e) });
        }
      }
    }
    // log for successes and failures
    let successCount = 0;
    let failureCount = 0;
    for (const r of results) {
      if (r.ok) {
        successCount += 1;
        log("[SEND_INITIAL] Sent to", r.to);
      } else {
        failureCount += 1;
        log("[SEND_INITIAL] Failed to send to", r.to, r.error);
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
