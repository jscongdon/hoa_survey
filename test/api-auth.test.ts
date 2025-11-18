import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/auth/jwt", () => ({
  verifyToken: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    memberList: { findMany: vi.fn() },
    survey: { findUnique: vi.fn(), update: vi.fn() },
    response: { count: vi.fn().mockResolvedValue(0) },
    question: { deleteMany: vi.fn(), create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import * as memberListsRoute from "../app/api/member-lists/route";
import * as surveyIdRoute from "../app/api/surveys/[id]/route";

describe("API auth fallback to cookie JWT", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("member-lists GET returns lists when cookie JWT is valid", async () => {
    (verifyToken as any).mockResolvedValue({ adminId: "admin1" });
    (prisma.memberList.findMany as any).mockResolvedValue([
      { id: "1", name: "List 1", _count: { members: 0, surveys: 0 } },
    ]);

    const req: any = {
      headers: { get: (k: string) => null },
      cookies: { get: (n: string) => ({ value: "token" }) },
    };

    const res: any = await (memberListsRoute as any).GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].id).toBe("1");
  });

  it("surveys/[id] GET returns survey when cookie JWT is valid", async () => {
    (verifyToken as any).mockResolvedValue({ adminId: "admin1" });
    (prisma.survey.findUnique as any).mockResolvedValue({
      id: "s1",
      title: "Survey 1",
      description: "Desc",
      opensAt: new Date().toISOString(),
      closesAt: new Date().toISOString(),
      questions: [],
    });

    const req: any = {
      headers: { get: (k: string) => null },
      cookies: { get: (n: string) => ({ value: "token" }) },
    };

    const res: any = await (surveyIdRoute as any).GET(req, {
      params: { id: "s1" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("s1");
    expect(body.title).toBe("Survey 1");
  });

  it("member-lists GET returns 401 when no token", async () => {
    (verifyToken as any).mockResolvedValue(null);
    const req: any = {
      headers: { get: (k: string) => null },
      cookies: { get: (n: string) => undefined },
    };

    const res: any = await (memberListsRoute as any).GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });
});
