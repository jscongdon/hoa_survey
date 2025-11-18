import { log, error as logError } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";

export async function GET(
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

  const { id } = await params;
  const survey = await prisma.survey.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { order: "asc" } },
      memberList: { select: { id: true, name: true } },
    },
  });

  if (!survey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Parse stored options (saved as JSON string) into arrays for the client
  const parsedQuestions = survey.questions.map((q) => ({
    id: q.id,
    surveyId: q.surveyId,
    type: q.type,
    text: q.text,
    order: q.order,
    options: q.options ? JSON.parse(q.options) : undefined,
    showWhen: q.showWhen ? JSON.parse(q.showWhen) : undefined,
    maxSelections: q.maxSelections || undefined,
    required: q.required || false,
  }));

  // Response counts
  const totalResponses = await prisma.response.count({
    where: { surveyId: survey.id },
  });
  const submittedResponses = await prisma.response.count({
    where: { surveyId: survey.id, submittedAt: { not: null } },
  });

  return NextResponse.json({
    id: survey.id,
    title: survey.title,
    description: survey.description,
    opensAt: survey.opensAt,
    closesAt: survey.closesAt,
    memberListId: survey.memberListId,
    memberListName: survey.memberList?.name,
    minResponses: survey.minResponses,
    minResponsesAll: survey.minResponsesAll,
    totalResponses,
    submittedResponses,
    questions: parsedQuestions,
  });
}

export async function PUT(
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
    const body = await req.json();
    const {
      title,
      description,
      opensAt,
      closesAt,
      questions,
      memberListId,
      minResponses,
      minResponsesAll,
    } = body;
    const { id } = await params;

    // Check if memberListId is changing and block if responses already exist
    if (memberListId) {
      const existing = await prisma.survey.findUnique({
        where: { id },
        select: { memberListId: true },
      });
      if (existing && existing.memberListId !== memberListId) {
        // Only block if there are submitted responses (submittedAt not null)
        const submittedCount = await prisma.response.count({
          where: { surveyId: id, submittedAt: { not: null } },
        });
        if (submittedCount > 0) {
          return NextResponse.json(
            {
              error:
                "Cannot change member list after submitted responses exist for this survey.",
            },
            { status: 409 }
          );
        }
      }
    }

    // Perform update + question replacement atomically
    await prisma.$transaction(async (tx) => {
      // If minResponsesAll is true, get the member count and set minResponses to that
      let finalMinResponses =
        minResponses !== undefined ? minResponses : undefined;
      if (minResponsesAll) {
        const survey = await tx.survey.findUnique({
          where: { id },
          select: { memberListId: true },
        });
        if (survey) {
          const memberCount = await tx.member.count({
            where: {
              lists: {
                some: { id: survey.memberListId },
              },
            },
          });
          finalMinResponses = memberCount;
        }
      }

      await tx.survey.update({
        where: { id },
        data: {
          title,
          description,
          opensAt: opensAt ? new Date(opensAt) : undefined,
          closesAt: closesAt ? new Date(closesAt) : undefined,
          memberListId: memberListId || undefined,
          minResponses: finalMinResponses,
          minResponsesAll:
            minResponsesAll !== undefined ? minResponsesAll : undefined,
        },
      });

      await tx.question.deleteMany({ where: { surveyId: id } });

      if (Array.isArray(questions) && questions.length > 0) {
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          await tx.question.create({
            data: {
              surveyId: id,
              text: q.text,
              type: q.type,
              order: typeof q.order === "number" ? q.order : i,
              options: q.options ? JSON.stringify(q.options) : null,
              showWhen: q.showWhen ? JSON.stringify(q.showWhen) : null,
              maxSelections: q.maxSelections
                ? parseInt(String(q.maxSelections))
                : null,
              required: q.required || false,
            },
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError(error);
    return NextResponse.json(
      { error: "Failed to update survey" },
      { status: 500 }
    );
  }
}
