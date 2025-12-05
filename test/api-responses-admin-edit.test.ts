import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/jwt", () => ({
  verifyToken: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";

describe("Admin edit response", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    // clean small set to avoid FK errors
    await prisma.answer.deleteMany();
    await prisma.response.deleteMany();
    await prisma.question.deleteMany();
    await prisma.survey.deleteMany();
    await prisma.member.deleteMany();
    await prisma.memberList.deleteMany();
    await prisma.admin.deleteMany();
  });

  it("allows FULL admin to update answers for a response", async () => {
    // create admin
    const admin = await prisma.admin.create({ data: { id: 'admin1', email: 'a@e.com', password: 'x', role: 'FULL' } });
    (verifyToken as any).mockResolvedValue({ adminId: 'admin1' });

    // create survey
    const ml = await prisma.memberList.create({ data: { name: "list" } });
    const survey = await prisma.survey.create({ data: { title: "S", opensAt: new Date(), closesAt: new Date(Date.now()+3600000), memberListId: ml.id } });
    const q1 = await prisma.question.create({ data: { surveyId: survey.id, text: 'Q1', type: 'MULTI_SINGLE', order: 0 } });
    const q2 = await prisma.question.create({ data: { surveyId: survey.id, text: 'Q2', type: 'MULTI_MULTI', order: 1 } });
    const m = await prisma.member.create({ data: { lot: '1', name: 'M', email: 'm@example.com', lists: { connect: { id: ml.id } } } });
    const r = await prisma.response.create({ data: { surveyId: survey.id, memberId: m.id, token: 't1' } });
    await prisma.answer.create({ data: { responseId: r.id, questionId: q1.id, value: JSON.stringify('A') } });

    const { PUT } = await import("../app/api/surveys/[id]/responses/[responseId]/route");
    const req = new Request(`http://localhost/api/surveys/${survey.id}/responses/${r.id}`, { method: 'PUT', body: JSON.stringify({ answers: { [q1.id]: 'B' } }) });
    // hack: attach cookies interface like Next.js request
    (req as any).cookies = { get: () => ({ value: 'token' }) };

    const res = await PUT(req as any, { params: Promise.resolve({ id: survey.id, responseId: r.id }) } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const answers = await prisma.answer.findMany({ where: { responseId: r.id } });
    expect(answers.length).toBe(1);
    expect(answers[0].value).toBe('B');
  });
});
