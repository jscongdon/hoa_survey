import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/jwt", () => ({
  verifyToken: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";

describe("Admin edit response", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    // clean only test-scoped rows to avoid FK errors and cross-test interference
    await prisma.answer.deleteMany();
    await prisma.response.deleteMany();
    await prisma.question.deleteMany();
    await prisma.survey.deleteMany({ where: { title: "S" } });
    await prisma.member.deleteMany({
      where: { lists: { some: { name: { startsWith: "list-" } } } },
    });
    await prisma.memberList.deleteMany({
      where: { name: { startsWith: "list-" } },
    });
    await prisma.admin.deleteMany({ where: { email: { contains: "a+" } } });
  });

  it("allows FULL admin to update answers for a response", async () => {
    // create admin
    const adminTimestamp = Date.now();
    const adminId = `admin-${adminTimestamp}`;
    const adminEmail = `a+${adminTimestamp}@e.com`;
    const admin = await prisma.admin.create({
      data: { id: adminId, email: adminEmail, password: "x", role: "FULL" },
    });
    // admin creation logged in test; mock verifyToken to ensure admin is FULL
    (verifyToken as any).mockResolvedValue({ adminId, role: "FULL" });

    // create survey
    const ml = await prisma.memberList.create({
      data: { name: `list-${Date.now()}` },
    });
    const survey = await prisma.survey.create({
      data: {
        title: "S",
        opensAt: new Date(),
        closesAt: new Date(Date.now() + 3600000),
        memberListId: ml.id,
      },
    });
    const q1 = await prisma.question.create({
      data: { surveyId: survey.id, text: "Q1", type: "MULTI_SINGLE", order: 0 },
    });
    const q2 = await prisma.question.create({
      data: { surveyId: survey.id, text: "Q2", type: "MULTI_MULTI", order: 1 },
    });
    const m = await prisma.member.create({
      data: {
        lot: "1",
        name: "M",
        email: "m@example.com",
        lists: { connect: { id: ml.id } },
      },
    });
    const r = await prisma.response.create({
      data: { surveyId: survey.id, memberId: m.id, token: "t1" },
    });
    await prisma.answer.create({
      data: { responseId: r.id, questionId: q1.id, value: JSON.stringify("A") },
    });

    const { PUT } =
      await import("../app/api/surveys/[id]/responses/[responseId]/route");
    const req = new Request(
      `http://localhost/api/surveys/${survey.id}/responses/${r.id}`,
      { method: "PUT", body: JSON.stringify({ answers: { [q1.id]: "B" } }) }
    );
    // hack: attach cookies interface like Next.js request
    (req as any).cookies = { get: () => ({ value: "token" }) };

    const res = await PUT(
      req as any,
      { params: Promise.resolve({ id: survey.id, responseId: r.id }) } as any
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const answers = await prisma.answer.findMany({
      where: { responseId: r.id },
    });
    expect(answers.length).toBe(1);
    expect(answers[0].value).toBe("B");
  });
});
