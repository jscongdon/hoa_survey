import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

describe("response persistence transaction", () => {
  let memberListId: string | null = null;
  let memberId: string | null = null;
  let surveyId: string | null = null;
  let q1Id: string | null = null;
  let q2Id: string | null = null;
  let responseId: string | null = null;

  beforeAll(async () => {
    const ml = await prisma.memberList.create({
      data: {
        name: "test-list",
        createdAt: new Date(),
      },
    });
    memberListId = ml.id;

    const member = await prisma.member.create({
      data: {
        lot: "1",
        name: "Test Member",
        email: `test+${Date.now()}@example.com`,
        createdAt: new Date(),
      },
    });
    memberId = member.id;

    const survey = await prisma.survey.create({
      data: {
        title: "test-survey",
        opensAt: new Date(),
        closesAt: new Date(Date.now() + 1000 * 60 * 60),
        memberListId: memberListId,
        minResponses: 1,
        createdAt: new Date(),
      },
    });
    surveyId = survey.id;

    const q1 = await prisma.question.create({
      data: { surveyId: surveyId, type: "MULTI_SINGLE", text: "q1", order: 0 },
    });
    q1Id = q1.id;

    const q2 = await prisma.question.create({
      data: { surveyId: surveyId, type: "MULTI_MULTI", text: "q2", order: 1 },
    });
    q2Id = q2.id;

    const resp = await prisma.response.create({
      data: {
        surveyId: surveyId,
        memberId: memberId,
        token: `t-${Date.now()}`,
        createdAt: new Date(),
      },
    });
    responseId = resp.id;
  });

  afterAll(async () => {
    if (responseId)
      await prisma.response.deleteMany({ where: { id: responseId } });
    if (q1Id) await prisma.question.deleteMany({ where: { id: q1Id } });
    if (q2Id) await prisma.question.deleteMany({ where: { id: q2Id } });
    if (surveyId) await prisma.survey.deleteMany({ where: { id: surveyId } });
    if (memberId) await prisma.member.deleteMany({ where: { id: memberId } });
    if (memberListId)
      await prisma.memberList.deleteMany({ where: { id: memberListId } });
    await prisma.$disconnect();
  });

  it("inserts answers and updates response in a transaction", async () => {
    const allowedAnswerEntries = [
      { questionId: q1Id!, value: "Choice1" },
      { questionId: q2Id!, value: JSON.stringify(["A", "B"]) },
    ];

    const answerRows = allowedAnswerEntries.map((entry) => ({
      responseId: responseId!,
      questionId: entry.questionId,
      value: entry.value,
      createdAt: new Date(),
    }));

    await prisma.$transaction(async (tx) => {
      await tx.answer.deleteMany({ where: { responseId: responseId! } });
      if (answerRows.length > 0) {
        await tx.answer.createMany({ data: answerRows });
      }
      await tx.response.update({
        where: { id: responseId! },
        data: { submittedAt: new Date() },
      });
    });

    const answers = await prisma.answer.findMany({
      where: { responseId: responseId! },
    });
    expect(answers.length).toBe(answerRows.length);
  });
});
