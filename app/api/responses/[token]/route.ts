import { log, error as logError } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, generateBaseEmail } from "@/lib/email/send";
import crypto from "crypto";
import { decryptMemberData } from "@/lib/encryption";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const response = await prisma.response.findUnique({
    where: { token },
    include: {
      survey: { include: { questions: { orderBy: { order: "asc" } } } },
      member: true,
      answers: true,
    },
  });

  if (!response) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  const now = new Date();
  const isClosed = response.survey.closesAt && now > response.survey.closesAt;

  // Load latest answers explicitly to avoid any timing/serialization issues
  let existingAnswers: Record<string, any> | null = null;
  if (response.submittedAt) {
    const answersRows = await prisma.answer.findMany({
      where: { responseId: response.id },
      orderBy: { createdAt: "asc" },
    });

    if (answersRows && answersRows.length > 0) {
      existingAnswers = answersRows.reduce(
        (acc: Record<string, any>, answer: any) => {
          try {
            acc[answer.questionId] = JSON.parse(answer.value);
          } catch {
            acc[answer.questionId] = answer.value;
          }
          return acc;
        },
        {}
      );
    }
  }

  // Parse survey questions options and showWhen for client consumption
  const parsedSurvey = response.survey
    ? {
        ...response.survey,
        questions: response.survey.questions.map((q: any) => ({
          id: q.id,
          surveyId: q.surveyId,
          type: q.type,
          text: q.text,
          order: q.order,
          options: q.options ? JSON.parse(q.options) : undefined,
          writeIn: q.writeIn || false,
          writeInCount: (q as any).writeInCount || 0,
          showWhen: q.showWhen ? JSON.parse(q.showWhen) : undefined,
          maxSelections: q.maxSelections || undefined,
          required: q.required || false,
        })),
      }
    : null;

  // Decrypt member data for display
  let decryptedMember = response.member;
  try {
    const decryptedData = await decryptMemberData({
      name: response.member.name,
      email: response.member.email,
      address: response.member.address || "",
      lot: response.member.lot,
    });
    decryptedMember = {
      ...response.member,
      name: decryptedData.name,
      email: decryptedData.email,
      address: decryptedData.address,
      lot: decryptedData.lot,
    };
  } catch (error) {
    // If decryption fails, use encrypted data (for backward compatibility)
    logError("Failed to decrypt member data in response:", error);
  }

  return NextResponse.json({
    ...response,
    member: decryptedMember,
    survey: parsedSurvey,
    isClosed,
    existingAnswers,
    signed: response.signed,
    signedAt: response.signedAt,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const body = await request.json();
    // Defensive: ensure answers is always an object to avoid runtime errors
    let answers = body?.answers;
    if (!answers || typeof answers !== "object") {
      answers = {};
    }
    const submittedByAdmin = body?.submittedByAdmin === true;
    const { token } = await params;
    // (no-op) incoming answers are processed below

    // Check if survey is still open
    const existingResponse = await prisma.response.findUnique({
      where: { token },
      include: {
        survey: true,
        member: true,
      },
    });

    if (!existingResponse) {
      return NextResponse.json(
        { error: "Response not found" },
        { status: 404 }
      );
    }

    // Check if response is signed (cannot be edited)
    if (existingResponse.signed) {
      return NextResponse.json(
        {
          error:
            "This response has been digitally signed and can no longer be edited",
        },
        { status: 403 }
      );
    }

    const now = new Date();
    if (
      existingResponse.survey.closesAt &&
      now > existingResponse.survey.closesAt
    ) {
      return NextResponse.json({ error: "Survey is closed" }, { status: 403 });
    }

    // We'll determine whether a signature token is required after loading the survey

    // (answer rows will be prepared after we compute allowedAnswerEntries)

    // Load survey questions (ordered) so we can evaluate any showWhen conditions
    const surveyWithQuestions = await prisma.survey.findUnique({
      where: { id: existingResponse.surveyId },
      include: {
        questions: { orderBy: { order: "asc" } },
        createdBy: true,
      },
    });

    const questions = surveyWithQuestions?.questions ?? [];

    // Helper: determine if a question should be considered enabled given submitted answers
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
        // Find trigger question by order
        const trigger = questions.find((t) => t.order === triggerOrder);
        if (!trigger) return false;
        const triggerAns = submittedAnswers[trigger.id];
        if (
          triggerAns === null ||
          triggerAns === undefined ||
          triggerAns === ""
        )
          return false;

        // Normalize answers for comparison
        if (Array.isArray(triggerAns)) {
          if (operator === "equals") {
            return triggerAns.includes(expected);
          }
          // contains on an array -> treat as includes
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

    // Filter out answers for questions that are disabled by showWhen
    const allowedAnswerEntries = Object.entries(answers)
      .filter(([, value]) => {
        // Skip empty values up-front
        if (value === null || value === undefined || value === "") return false;
        if (Array.isArray(value) && value.length === 0) return false;
        return true;
      })
      .filter(([questionId]) => {
        // Find question object for this id
        const q = questions.find((q2) => q2.id === questionId);
        // If question not found in survey, skip it
        if (!q) return false;
        return isQuestionEnabled(q, answers);
      })
      .map(([questionId, value]) => ({
        questionId,
        value:
          typeof value === "object" ? JSON.stringify(value) : String(value),
      }));

    // Determine whether this survey requires a digital signature
    const requiresSignature =
      surveyWithQuestions?.requireSignature !== false && !submittedByAdmin;

    const signatureToken = requiresSignature
      ? crypto.randomBytes(32).toString("hex")
      : null;

    const updateData: any = {
      submittedAt: new Date(),
    };

    // Allowed answer entries computed; proceed to persist them

    if (requiresSignature) {
      updateData.signatureToken = signatureToken;
    } else {
      updateData.signed = true;
      updateData.signedAt = new Date();
    }

    // Prepare answer rows for createMany
    const answerRows = allowedAnswerEntries.map((entry) => ({
      responseId: existingResponse.id,
      questionId: entry.questionId,
      value: entry.value,
    }));

    // Use a transaction: delete old answers, create new ones, then update response metadata
    const txResult = await prisma.$transaction(async (tx) => {
      await tx.answer.deleteMany({
        where: { responseId: existingResponse.id },
      });
      if (answerRows.length > 0) {
        // createMany is faster and avoids nesting; value is required and should be a string
        await tx.answer.createMany({ data: answerRows });
      }

      const resp = await tx.response.update({
        where: { token },
        data: updateData,
      });

      return resp;
    });

    // Fetch updated response including answers for logging
    const response = await prisma.response.findUnique({
      where: { token },
      include: { answers: true },
    });

    // Updated response and answers persisted

    // Send signature request email (only if survey requires a signature)
    try {
      if (requiresSignature) {
        const isDevelopment = process.env.NODE_ENV === "development";
        let baseUrl: string;
        if (isDevelopment) {
          baseUrl = process.env.DEVELOPMENT_URL || "http://localhost:3000";
        } else {
          baseUrl = process.env.PRODUCTION_URL || "";
          if (!baseUrl) {
            throw new Error("Production URL not configured");
          }
        }
        const signatureUrl = `${baseUrl}/survey/${token}/sign/${signatureToken}`;
        const viewResponseUrl = `${baseUrl}/survey/${token}`;

        const bodyHtml = `
        <p>Thank you for submitting your response to the survey: <strong>${existingResponse.survey.title}</strong></p>
        <p>To validate the authenticity of your submission, please click the button below to digitally sign your response:</p>
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e;"><strong>Important:</strong> Once you sign your response, it can no longer be changed or edited. Please review your answers before signing.</p>
        </div>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${viewResponseUrl}" style="color: #2563eb; text-decoration: none;">View Your Response</a>
        </div>
        <p>If you did not submit this response or have any questions, please contact the administrator.</p>
      `;

        const emailHtml = generateBaseEmail(
          `Digital Signature Request`,
          `Hello ${existingResponse.member.name},`,
          bodyHtml,
          { text: "Sign Your Response", url: signatureUrl },
          "This is an automated email. Please do not reply directly to this message."
        );

        await sendEmail({
          to: existingResponse.member.email,
          subject: `Digital Signature Request: ${existingResponse.survey.title}`,
          html: emailHtml,
        });
      }
    } catch (emailError) {
      logError("Failed to send signature email:", emailError);
      // Continue even if email fails - response was saved successfully
    }

    // After saving the response and sending signature email, check whether
    // we should notify the survey creator that the minimal responses threshold
    // has been reached.
    try {
      const survey = await prisma.survey.findUnique({
        where: { id: existingResponse.surveyId },
        include: {
          questions: { orderBy: { order: "asc" } },
          responses: {
            where: { submittedAt: { not: null } },
            include: { answers: true },
          },
          createdBy: true,
        },
      });

      if (
        survey &&
        (survey as any).notifyOnMinResponses &&
        survey.minResponses &&
        survey.responses.length >= survey.minResponses &&
        !(survey as any).minimalNotifiedAt &&
        survey.createdBy &&
        survey.createdBy.email
      ) {
        // Build a compact results summary (basic counts / averages)
        const responses = survey.responses.map((r) => ({
          id: r.id,
          answers: r.answers.reduce(
            (acc: any, answer: any) => {
              try {
                acc[answer.questionId] = JSON.parse(answer.value);
              } catch {
                acc[answer.questionId] = answer.value;
              }
              return acc;
            },
            {} as Record<string, any>
          ),
        }));

        const questionStats = survey.questions.map((question) => {
          const questionAnswers = responses
            .map((response) => response.answers[question.id])
            .filter((a) => a !== undefined && a !== null && a !== "")
            .filter((a) => !(Array.isArray(a) && a.length === 0));

          const stats: any = {
            questionId: question.id,
            text: question.text,
            type: question.type,
            totalResponses: questionAnswers.length,
          };

          if (question.type === "YES_NO" || question.type === "MULTI_SINGLE") {
            const counts: Record<string, number> = {};
            questionAnswers.forEach((answer) => {
              if (
                answer &&
                typeof answer === "object" &&
                answer.choice === "__WRITE_IN__"
              ) {
                const writeText = String(answer.writeIn || "").trim();
                const key = writeText !== "" ? writeText : "Other";
                counts[key] = (counts[key] || 0) + 1;
              } else {
                const key = String(answer);
                counts[key] = (counts[key] || 0) + 1;
              }
            });
            stats.counts = counts;
          } else if (question.type === "MULTI_MULTI") {
            const counts: Record<string, number> = {};
            questionAnswers.forEach((answer) => {
              if (Array.isArray(answer)) {
                answer.forEach((opt: any) => {
                  if (
                    opt &&
                    typeof opt === "object" &&
                    opt.choice === "__WRITE_IN__"
                  ) {
                    const writeText = String(opt.writeIn || "").trim();
                    const key = writeText !== "" ? writeText : "Other";
                    counts[key] = (counts[key] || 0) + 1;
                  } else {
                    const key = String(opt);
                    counts[key] = (counts[key] || 0) + 1;
                  }
                });
              }
            });
            stats.counts = counts;
          } else if (question.type === "RATING_5") {
            const ratings = questionAnswers.map((a: any) => Number(a));
            const sum = ratings.reduce((acc: number, v: number) => acc + v, 0);
            const avg = ratings.length > 0 ? sum / ratings.length : 0;
            const counts: Record<string, number> = {};
            ratings.forEach((rating) => {
              counts[String(rating)] = (counts[String(rating)] || 0) + 1;
            });
            stats.average = Math.round(avg * 10) / 10;
            stats.counts = counts;
          } else if (question.type === "PARAGRAPH") {
            stats.responses = questionAnswers;
          }

          return stats;
        });

        // Generate compact HTML summary
        let summaryHtml = `<p>The survey <strong>${survey.title}</strong> has reached its minimal response threshold of <strong>${survey.minResponses}</strong>. Here is a brief summary of results so far:</p>`;
        questionStats.forEach((qs) => {
          summaryHtml += `<h4 style="margin:0 0 6px 0">${qs.text}</h4>`;
          if (qs.counts) {
            summaryHtml += `<ul style="margin:0 0 12px 18px">`;
            const entries = Object.entries(qs.counts || {});
            entries.sort((a, b) => {
              const diff = Number(b[1] || 0) - Number(a[1] || 0);
              if (diff !== 0) return diff;
              return String(a[0]).localeCompare(String(b[0]));
            });
            entries.forEach(([k, v]) => {
              summaryHtml += `<li>${k}: ${v}</li>`;
            });
            summaryHtml += `</ul>`;
          } else if (qs.responses) {
            summaryHtml += `<ul style="margin:0 0 12px 18px">`;
            qs.responses.slice(0, 10).forEach((r: any) => {
              summaryHtml += `<li>${String(r)}</li>`;
            });
            summaryHtml += `</ul>`;
          } else if (qs.average !== undefined) {
            summaryHtml += `<p style="margin:0 0 12px 0">Average: ${qs.average} (${qs.totalResponses} responses)</p>`;
          } else {
            summaryHtml += `<p style="margin:0 0 12px 0">${qs.totalResponses} responses</p>`;
          }
        });

        const notifyUrl =
          (process.env.PRODUCTION_URL ||
            process.env.DEVELOPMENT_URL ||
            "http://localhost:3000") +
          `/dashboard/surveys/${survey.id}/results`;

        const emailHtml = generateBaseEmail(
          `Survey Reached Minimal Responses: ${survey.title}`,
          `Hello ${survey.createdBy.name},`,
          summaryHtml +
            `<p style="margin-top:12px"><a href="${notifyUrl}" style="color:#2563eb; text-decoration:none">View full results</a></p>`,
          undefined,
          "This is an automated notification."
        );

        await sendEmail({
          to: survey.createdBy.email,
          subject: `Survey reached minimal responses: ${survey.title}`,
          html: emailHtml,
        });

        // Mark survey as notified to avoid duplicates
        // Cast to `any` because the generated Prisma client in this
        // environment may be out-of-date with the schema (types missing).
        // Casting here avoids a TypeScript error; production runtime will
        // still perform the update as expected. Consider running
        // `npx prisma generate` to refresh types.
        await prisma.survey.update({
          where: { id: survey.id },
          data: { minimalNotifiedAt: new Date() } as any,
        });
      }
    } catch (notifyError) {
      logError(
        "Error while sending minimal response notification:",
        notifyError
      );
    }

    return NextResponse.json({ success: true, response });
  } catch (error) {
    logError(error);
    return NextResponse.json(
      { error: "Failed to submit response" },
      { status: 500 }
    );
  }
}
