import { log, error as logError } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import {
  sendBulkEmails,
  sendEmail,
  generateSurveyEmail,
} from "@/lib/email/send";
import { getBaseUrl } from "@/lib/app-url";
import { decryptMemberData } from "@/lib/encryption";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  try {
    const { id } = await params;

    // Get survey with responses that haven't been submitted
    const survey = await prisma.survey.findUnique({
      where: { id },
      include: {
        responses: {
          where: { submittedAt: null },
          include: { member: true },
        },
      },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    // Check if survey is still open
    if (new Date() > survey.closesAt) {
      return NextResponse.json({ error: "Survey is closed" }, { status: 400 });
    }

    const pendingResponses = survey.responses;

    log("[REMIND] Survey:", survey.id, survey.title);
    log("[REMIND] Total responses:", survey.responses.length);
    log("[REMIND] Pending (unsubmitted):", pendingResponses.length);

    if (pendingResponses.length === 0) {
      return NextResponse.json({
        message: "No pending responses to remind",
        count: 0,
        debug: {
          surveyId: survey.id,
          totalResponses: survey.responses.length,
        },
      });
    }

    // Determine base URL for links
    const baseUrl = await getBaseUrl();

    let sent = 0;
    let failed = 0;

    // Build email items list
    const emailItems = await Promise.all(
      pendingResponses.map(async (response) => {
        try {
          // decrypt member fields (email, name, lot may be encrypted)
          const decrypted = await decryptMemberData({
            name: response.member.name || "",
            email: response.member.email || "",
            address: response.member.address || "",
            lot: response.member.lot || "",
          });

          if (!decrypted.email) {
            logError(
              "[REMIND] Missing email for member, skipping",
              response.member.id || response.member
            );
            failed += 1;
            return;
          }
          log(
            "[REMIND] Sending to:",
            decrypted.email,
            "Token:",
            response.token
          );

          const link = `${baseUrl}/survey/${response.token}`;
          const html = generateSurveyEmail(
            survey.title,
            survey.description || "",
            link,
            decrypted.lot,
            decrypted.name
          );

          return {
            options: {
              to: decrypted.email,
              subject: `Reminder: ${survey.title}`,
              html,
              text: `Please complete the survey: ${link}`,
            },
            meta: {
              responseId: response.id,
              memberId: response.memberId,
              email: decrypted.email,
            },
          };
        } catch (err) {
          logError(
            "[REMIND] Failed to prepare reminder for",
            response.member.email,
            err
          );
          return null;
        }
      })
    );

    // Filter out any nulls (failed to prepare) and send in batches
    const itemsToSend = emailItems.filter(Boolean) as Array<{
      options: any;
      meta: any;
    }>;
    let results = [] as any[];
    if (typeof sendBulkEmails === "function") {
      results = await sendBulkEmails(itemsToSend, {
        batchSize: 50,
        delayMsBetweenBatches: 1000,
        retryCount: 1,
        retryDelayMs: 500,
      });
    } else {
      for (const it of itemsToSend) {
        try {
          await sendEmail(it.options);
          results.push({ to: it.options.to, ok: true, meta: it.meta });
        } catch (e) {
          results.push({
            to: it.options.to,
            ok: false,
            error: String(e),
            meta: it.meta,
          });
        }
      }
    }

    for (const r of results) {
      if (r.ok) {
        sent += 1;
        try {
          await prisma.reminder.create({
            data: {
              surveyId: survey.id,
              memberId: r.meta.memberId,
              sentAt: new Date(),
              reminderNum:
                (await prisma.reminder.count({
                  where: { surveyId: survey.id, memberId: r.meta.memberId },
                })) + 1,
            },
          });
          log("[REMIND] Sent successfully to:", r.to);
        } catch (e) {
          logError("[REMIND] Failed to record reminder for", r.to, e);
        }
      } else {
        failed += 1;
        logError("[REMIND] Failed to send to", r.to, r.error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Reminders sent: ${sent}, failed: ${failed}`,
      sent,
      failed,
    });
  } catch (error) {
    logError("Reminder error:", error);
    return NextResponse.json(
      { error: "Failed to send reminders" },
      { status: 500 }
    );
  }
}
