import { log, error as logError } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { sendEmail, generateSurveyEmail } from "@/lib/email/send";
import { getBaseUrl } from "@/lib/app-url";
import { decryptMemberData } from "@/lib/encryption";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; responseId: string }> }
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
    const { id, responseId } = await context.params;

    // Get survey
    const survey = await prisma.survey.findUnique({
      where: { id },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    // Check if survey is still open
    if (new Date() > survey.closesAt) {
      return NextResponse.json({ error: "Survey is closed" }, { status: 400 });
    }

    // Get the specific response
    const response = await prisma.response.findUnique({
      where: { id: responseId },
      include: { member: true },
    });

    if (!response) {
      return NextResponse.json(
        { error: "Response not found" },
        { status: 404 }
      );
    }

    if (response.surveyId !== id) {
      return NextResponse.json(
        { error: "Response does not belong to this survey" },
        { status: 400 }
      );
    }

    if (response.submittedAt) {
      return NextResponse.json(
        { error: "Member has already responded" },
        { status: 400 }
      );
    }

    // Determine base URL for links
    const baseUrl = await getBaseUrl();

    try {
      // decrypt member fields (email/name/lot may be encrypted)
      const decrypted = await decryptMemberData({
        name: response.member.name || "",
        email: response.member.email || "",
        address: response.member.address || "",
        lot: response.member.lot || "",
      });

      if (!decrypted.email) {
        logError(
          "[SPECIFIC_REMIND] Missing email for member, cannot send reminder",
          response.member.id || response.member
        );
        return NextResponse.json(
          { error: "Member email unavailable" },
          { status: 400 }
        );
      }
      log(
        "[SPECIFIC_REMIND] Sending to:",
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

      await sendEmail({
        to: decrypted.email,
        subject: `Reminder: ${survey.title}`,
        html,
        text: `Please complete the survey: ${link}`,
      });

      log("[SPECIFIC_REMIND] Sent successfully to:", response.member.email);

      // Record reminder
      await prisma.reminder.create({
        data: {
          surveyId: survey.id,
          memberId: response.memberId,
          sentAt: new Date(),
          reminderNum:
            (await prisma.reminder.count({
              where: { surveyId: survey.id, memberId: response.memberId },
            })) + 1,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Reminder sent to ${response.member.name}`,
      });
    } catch (err) {
      logError(
        "[SPECIFIC_REMIND] Failed to send reminder to",
        response.member.email,
        err
      );
      return NextResponse.json(
        { error: "Failed to send reminder" },
        { status: 500 }
      );
    }
  } catch (error) {
    logError("[SPECIFIC_REMIND] Error:", error);
    return NextResponse.json(
      { error: "Failed to send reminder" },
      { status: 500 }
    );
  }
}
