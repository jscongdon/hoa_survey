import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { log, error as logError } from "@/lib/logger";
import crypto from "crypto";

async function isAdminFull(tokenVal?: string | null) {
  try {
    if (!tokenVal) return false;
    const payload = await verifyToken(tokenVal);
    if (!payload?.adminId) return false;
    // If the token includes role info, prefer that to avoid additional DB lookup for tests/mocks
    if (payload?.role === "FULL") return true;
    const admin = await prisma.admin.findUnique({
      where: { id: payload.adminId },
    });
    return admin?.role === "FULL";
  } catch (e) {
    return false;
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; responseId: string }> }
) {
  try {
    const { id, responseId } = await params;
    const cookieStore = request.cookies;
    const token = cookieStore.get("auth-token")?.value;

    // Ensure admin FULL
    const isFull = await isAdminFull(token);
    if (!isFull) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    let answers = body?.answers ?? {};
    if (!answers || typeof answers !== "object") answers = {};

    // Load response and survey questions
    const responseRow = await prisma.response.findUnique({
      where: { id: responseId },
      include: { survey: true },
    });
    if (!responseRow)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (responseRow.surveyId !== id)
      return NextResponse.json(
        { error: "Response does not belong to the survey" },
        { status: 400 }
      );

    const survey = await prisma.survey.findUnique({
      where: { id: responseRow.surveyId },
      include: { questions: { orderBy: { order: "asc" } } },
    });
    if (!survey)
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });

    const questions = survey.questions ?? [];

    function isQuestionEnabled(
      q: any,
      submittedAnswers: Record<string, any>
    ): boolean {
      if (!q.showWhen) return true;
      try {
        const cond =
          typeof q.showWhen === "string" ? JSON.parse(q.showWhen) : q.showWhen;
        const triggerOrder = cond.triggerOrder;
        const operator = cond.operator;
        const expected = cond.value;
        const trigger = questions.find((t) => t.order === triggerOrder);
        if (!trigger) return false;
        const triggerAns = submittedAnswers[trigger.id];
        if (
          triggerAns === null ||
          triggerAns === undefined ||
          triggerAns === ""
        )
          return false;
        if (Array.isArray(triggerAns)) {
          if (operator === "equals") return triggerAns.includes(expected);
          return triggerAns.some((a: any) =>
            String(a).includes(String(expected))
          );
        }
        const asStr = String(triggerAns);
        if (operator === "equals") return asStr === String(expected);
        return asStr.includes(String(expected));
      } catch (e) {
        return false;
      }
    }

    const allowedAnswerEntries = Object.entries(answers)
      .filter(([, value]) => {
        if (value === null || value === undefined || value === "") return false;
        if (Array.isArray(value) && value.length === 0) return false;
        return true;
      })
      .filter(([questionId]) => {
        const q = questions.find((q2) => q2.id === questionId);
        if (!q) return false;
        return isQuestionEnabled(q, answers);
      })
      .map(([questionId, value]) => ({
        questionId,
        value:
          typeof value === "object" ? JSON.stringify(value) : String(value),
      }));

    // Prepare transaction to update answers
    const updated = await prisma.$transaction(async (tx) => {
      await tx.answer.deleteMany({ where: { responseId } });
      if (allowedAnswerEntries.length > 0) {
        await tx.answer.createMany({
          data: allowedAnswerEntries.map((e) => ({
            responseId,
            questionId: e.questionId,
            value: e.value,
          })),
        });
      }
      const resp = await tx.response.update({
        where: { id: responseId },
        data: {},
      });
      return resp;
    });

    log(`[ADMIN_EDIT] Admin updated response ${responseId} on survey ${id}`);
    return NextResponse.json({ success: true, updated });
  } catch (error) {
    logError("Failed admin update response:", error);
    return NextResponse.json(
      { error: "Failed to update response" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; responseId: string }> }
) {
  try {
    const { id: surveyId, responseId } = await params;

    // Verify authentication
    const token = req.cookies.get("auth-token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Check if user has FULL access
    // If verifyToken included role, we can trust it to quickly authorize rather than querying DB.
    if (payload.role !== "FULL") {
      const admin = await prisma.admin.findUnique({
        where: { id: payload.adminId },
      });
      if (!admin || admin.role !== "FULL") {
        return NextResponse.json(
          {
            error: "Forbidden - FULL access required",
          },
          { status: 403 }
        );
      }
    }

    // Verify the response exists and belongs to this survey
    const response = await prisma.response.findUnique({
      where: { id: responseId },
    });

    if (!response) {
      return NextResponse.json(
        { error: "Response not found" },
        { status: 404 }
      );
    }

    if (response.surveyId !== surveyId) {
      return NextResponse.json(
        { error: "Response does not belong to this survey" },
        { status: 400 }
      );
    }

    // Store member ID and clear answers for this response and mark as unsubmitted
    const memberId = response.memberId;

    // Use a transaction to delete all answers for this response and mark the response as unsubmitted.
    // Keep the same response row so the token and relation remain intact.
    await prisma.$transaction(async (tx) => {
      await tx.answer.deleteMany({ where: { responseId } });
      await tx.response.update({
        where: { id: responseId },
        data: {
          submittedAt: null,
          signed: false,
          signedAt: null,
          signatureToken: null,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Response deleted successfully and new response created",
    });
  } catch (error) {
    logError("Error deleting response:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
