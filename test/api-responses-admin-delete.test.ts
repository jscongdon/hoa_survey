import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { vi } from "vitest";

vi.mock("@/lib/auth/jwt", () => ({ verifyToken: vi.fn() }));
import { verifyToken } from "@/lib/auth/jwt";

describe("Admin delete response - clears answers and marks unsubmitted", () => {
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

  it("clears answers and sets submittedAt to null instead of creating a new response", async () => {
    // create admin
    const admin = await prisma.admin.create({
      data: { id: "admin-d1", email: "a@e.com", password: "x", role: "FULL" },
    });
    (verifyToken as any).mockResolvedValue({ adminId: admin.id });

    // create survey, memberlist, member, response and answer
    const ml = await prisma.memberList.create({ data: { name: "list" } });
    const survey = await prisma.survey.create({ data: { title: "S", opensAt: new Date(), closesAt: new Date(Date.now() + 3600000), memberListId: ml.id } });
    const q = await prisma.question.create({ data: { surveyId: survey.id, text: "Q1", type: "MULTI_SINGLE", order: 0 } });
    const m = await prisma.member.create({ data: { lot: "1", name: "M", email: "m@example.com", lists: { connect: { id: ml.id } } } });
    const r = await prisma.response.create({ data: { surveyId: survey.id, memberId: m.id, token: "t-deleteme", submittedAt: new Date() } });
    await prisma.answer.create({ data: { responseId: r.id, questionId: q.id, value: "A" } });

    const { DELETE } = await import(
      "../app/api/surveys/[id]/responses/[responseId]/route"
    );

    const req = new Request(`http://localhost/api/surveys/${survey.id}/responses/${r.id}`, { method: "DELETE" });
    (req as any).cookies = { get: () => ({ value: "token" }) };

    const res = await DELETE(req as any, { params: Promise.resolve({ id: survey.id, responseId: r.id }) } as any);
    expect(res.status).toBe(200);

    const respAfter = await prisma.response.findUnique({ where: { id: r.id } });
    expect(respAfter).not.toBeNull();
    expect(respAfter?.submittedAt).toBeNull();

    const answersAfter = await prisma.answer.findMany({ where: { responseId: r.id } });
    expect(answersAfter.length).toBe(0);
  });
});
