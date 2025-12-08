import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/jwt", () => ({
  verifyToken: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    survey: { findUnique: vi.fn() },
    response: { findMany: vi.fn() },
    member: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/encryption", () => ({
  decryptMemberData: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { decryptMemberData } from "@/lib/encryption";

describe("Non-respondents API - Basic", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("requires authentication", async () => {
    (verifyToken as any).mockResolvedValue(null);

    const req: any = {
      headers: { get: () => null },
      cookies: { get: () => undefined },
    };

    // Import the route dynamically to avoid issues
    const { GET } =
      await import("../app/api/surveys/[id]/nonrespondents/route");
    const res: any = await GET(req, {
      params: Promise.resolve({ id: "survey1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent survey", async () => {
    (verifyToken as any).mockResolvedValue({ adminId: "admin1", role: "FULL" });
    (prisma.survey.findUnique as any).mockResolvedValue(null);

    const req: any = {
      headers: { get: () => null },
      cookies: { get: () => ({ value: "token" }) },
    };

    const { GET } =
      await import("../app/api/surveys/[id]/nonrespondents/route");
    const res: any = await GET(req, {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    expect(res.status).toBe(404);
  });

  it("includes reminderCount for each nonrespondent", async () => {
    (verifyToken as any).mockResolvedValue({ adminId: "admin1", role: "FULL" });
    (prisma.survey.findUnique as any).mockResolvedValue({ id: "s1" });
    (prisma.response.findMany as any).mockResolvedValue([
      {
        id: "resp1",
        token: "token1",
        member: {
          id: "m1",
          name: "Jane Doe",
          email: "jane@example.com",
          lot: "101",
        },
      },
    ]);
    (prisma.reminder as any) = { count: vi.fn().mockResolvedValue(2) };
    (decryptMemberData as any).mockResolvedValue({
      name: "Jane Doe",
      email: "jane@example.com",
      lot: "101",
      address: "",
    });

    const req: any = {
      headers: { get: () => null },
      cookies: { get: () => ({ value: "token" }) },
      url: "http://localhost/api/surveys/s1/nonrespondents",
    };
    const { GET } =
      await import("../app/api/surveys/[id]/nonrespondents/route");
    const res: any = await GET(req, { params: Promise.resolve({ id: "s1" }) });
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toHaveProperty("reminderCount");
    expect(body[0].reminderCount).toBe(2);
  });
});
