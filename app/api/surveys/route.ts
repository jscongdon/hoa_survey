import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { verifyToken } from "@/lib/auth/jwt";
import { log, error as logError } from "@/lib/logger";

export async function GET(request: NextRequest) {
  let adminId = request.headers.get("x-admin-id");

  // If the middleware didn't provide admin id in headers, try cookie-based JWT
  if (!adminId) {
    const token = request.cookies.get("auth-token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const payload = await verifyToken(token as string);
    if (!payload?.adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    adminId = payload.adminId;
  }

  const surveys = await prisma.survey.findMany({
    include: {
      memberList: true,
      responses: true,
      questions: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const surveysWithStats = surveys.map((survey: any) => ({
    ...survey,
    totalRecipients: survey.responses.length,
    submittedCount: survey.responses.filter((r: any) => r.submittedAt).length,
    responseRate:
      survey.responses.length > 0
        ? Math.round(
            (survey.responses.filter((r: any) => r.submittedAt).length /
              survey.responses.length) *
              100
          )
        : 0,
  }));

  return NextResponse.json(surveysWithStats);
}

export async function POST(request: NextRequest) {
  let adminId = request.headers.get("x-admin-id");

  if (!adminId) {
    const token = request.cookies.get("auth-token")?.value;
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
    const body = await request.json();
    log("[CREATE_SURVEY] Request body:", JSON.stringify(body, null, 2));
    const {
      title,
      description,
      opensAt,
      closesAt,
      memberListId,
      showLive,
      showAfterClose,
      minResponses,
      minResponsesAll,
      requireSignature,
      questions,
    } = body;

    log("[CREATE_SURVEY] Parsed fields:", {
      title,
      memberListId,
      minResponses,
      minResponsesAll,
      questionsCount: questions?.length,
    });

    const survey = await prisma.$transaction(async (tx) => {
      log("[CREATE_SURVEY] Creating survey...");

      // If minResponsesAll is true, get the member count and set minResponses to that
      let finalMinResponses = minResponses || null;
      if (minResponsesAll) {
        const memberCount = await tx.member.count({
          where: {
            lists: {
              some: { id: memberListId },
            },
          },
        });
        finalMinResponses = memberCount;
        log(
          "[CREATE_SURVEY] minResponsesAll=true, setting minResponses to member count:",
          memberCount
        );
      }

      const created = await tx.survey.create({
        data: {
          title,
          description,
          opensAt: new Date(opensAt),
          closesAt: new Date(closesAt),
          memberListId,
          showLive,
          showAfterClose,
          minResponses: finalMinResponses,
          minResponsesAll: minResponsesAll || false,
          requireSignature:
            typeof requireSignature === "boolean" ? requireSignature : true,
        },
      });
      log("[CREATE_SURVEY] Survey created:", created.id);

      if (Array.isArray(questions) && questions.length > 0) {
        log("[CREATE_SURVEY] Creating questions...");
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          log("[CREATE_SURVEY] Question", i, ":", JSON.stringify(q));
          await tx.question.create({
            data: {
              surveyId: created.id,
              text: q.text,
              type: q.type,
              order: typeof q.order === "number" ? q.order : i,
              options: q.options ? JSON.stringify(q.options) : null,
              writeIn: q.writeIn || false,
              writeInCount: (q as any).writeInCount
                ? parseInt(String((q as any).writeInCount))
                : 0,
              showWhen: q.showWhen ? JSON.stringify(q.showWhen) : null,
              maxSelections: q.maxSelections
                ? parseInt(String(q.maxSelections))
                : null,
              required: q.required || false,
            } as Prisma.QuestionUncheckedCreateInput,
          });
        }
        log("[CREATE_SURVEY] Questions created");
      }

      // Create response records for all members in the list
      log("[CREATE_SURVEY] Fetching members for list:", memberListId);
      const members = await tx.member.findMany({
        where: {
          lists: {
            some: { id: memberListId },
          },
        },
      });
      log("[CREATE_SURVEY] Found members:", members.length);

      for (const member of members) {
        const crypto = await import("crypto");
        const token = crypto.randomBytes(32).toString("hex");

        await tx.response.create({
          data: {
            surveyId: created.id,
            memberId: member.id,
            token,
          },
        });
      }
      log("[CREATE_SURVEY] Responses created");

      return created;
    });

    log("[CREATE_SURVEY] Transaction complete");
    return NextResponse.json(survey, { status: 201 });
  } catch (error) {
    logError("[CREATE_SURVEY] ERROR:", error);
    logError(
      "[CREATE_SURVEY] Error stack:",
      error instanceof Error ? error.stack : "No stack"
    );
    logError(
      "[CREATE_SURVEY] Error details:",
      JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
    return NextResponse.json(
      {
        error: "Failed to create survey",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
