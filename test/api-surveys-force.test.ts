import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/jwt", () => ({
  verifyToken: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    survey: { findUnique: vi.fn() },
    response: { count: vi.fn() },
    admin: { findUnique: vi.fn() },
    $transaction: vi.fn(),
    question: {},
  },
}));

import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";

describe("Survey force update", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("blocks memberList change when submitted responses exist without force", async () => {
    (verifyToken as any).mockResolvedValue({ adminId: "a1", role: "FULL" });
    (prisma.survey.findUnique as any).mockResolvedValue({
      memberListId: "list1",
    });
    (prisma.response.count as any).mockResolvedValue(2);

    const { PUT } = await import("../app/api/surveys/[id]/route");

    const req: any = {
      headers: { get: () => null },
      cookies: { get: () => ({ value: "token" }) },
      json: async () => ({ memberListId: "list2" }),
    };

    const res: any = await PUT(req, { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/Cannot change member list/);
  });

  it("allows force update for FULL admin", async () => {
    (verifyToken as any).mockResolvedValue({ adminId: "a1", role: "FULL" });
    (prisma.survey.findUnique as any).mockResolvedValue({
      memberListId: "list1",
    });
    (prisma.response.count as any).mockResolvedValue(2);
    (prisma.admin.findUnique as any).mockResolvedValue({
      id: "a1",
      role: "FULL",
    });

    // $transaction will be attempted; stub a successful result
    (prisma.$transaction as any).mockResolvedValue({});

    const { PUT } = await import("../app/api/surveys/[id]/route");

    const req: any = {
      headers: { get: () => null },
      cookies: { get: () => ({ value: "token" }) },
      json: async () => ({ memberListId: "list2", force: true }),
    };

    const res: any = await PUT(req, { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("rejects force update for non-FULL admin", async () => {
    (verifyToken as any).mockResolvedValue({ adminId: "a1", role: "LIMITED" });
    (prisma.survey.findUnique as any).mockResolvedValue({
      memberListId: "list1",
    });
    (prisma.response.count as any).mockResolvedValue(2);
    (prisma.admin.findUnique as any).mockResolvedValue({
      id: "a1",
      role: "LIMITED",
    });

    const { PUT } = await import("../app/api/surveys/[id]/route");

    const req: any = {
      headers: { get: () => null },
      cookies: { get: () => ({ value: "token" }) },
      json: async () => ({ memberListId: "list2", force: true }),
    };

    const res: any = await PUT(req, { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/Insufficient permissions/);
  });
});
