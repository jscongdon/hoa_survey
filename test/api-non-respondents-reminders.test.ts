import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/jwt", () => ({
  verifyToken: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    survey: { findUnique: vi.fn() },
    response: { findMany: vi.fn(), count: vi.fn() },
    reminder: { count: vi.fn(), groupBy: vi.fn() },
  },
}));

vi.mock("@/lib/encryption", () => ({
  decryptMemberData: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { decryptMemberData } from "@/lib/encryption";

describe("Non-respondents API - reminders exact filter", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("filters `reminders=1` exactly (returns only members with exactly 1 reminder)", async () => {
    (verifyToken as any).mockResolvedValue({ adminId: "admin1" });
    (prisma.survey.findUnique as any).mockResolvedValue({ id: "s1" });

    // responses with 2 members
    const allResponses = [
      {
        id: "resp1",
        token: "token1",
        member: { id: "m1", name: "Jane", email: "j@example.com", lot: "1" },
      },
      {
        id: "resp2",
        token: "token2",
        member: { id: "m2", name: "Bob", email: "b@example.com", lot: "2" },
      },
    ];
    (prisma.response.findMany as any).mockImplementation(async (opts: any) => {
      // if select requests `memberId`, return reduced shape
      if (opts && opts.select && opts.select.memberId) {
        return allResponses.map((r) => ({ memberId: r.member.id }));
      }
      if (opts && opts.where && opts.where.memberId && opts.where.memberId.in) {
        return allResponses.filter((r) =>
          (opts.where.memberId.in as string[]).includes(r.member.id)
        );
      }
      return allResponses;
    });

    // groupBy returns counts per member; m1 has 1 reminder, m2 has 2 reminders
    (prisma.reminder as any).groupBy = vi.fn().mockResolvedValue([
      { memberId: "m1", _count: { _all: 1 } },
      { memberId: "m2", _count: { _all: 2 } },
    ]);

    (prisma.reminder as any).count = vi.fn().mockResolvedValue(1);
    (decryptMemberData as any).mockResolvedValue({
      name: "Jane",
      email: "j@example.com",
      lot: "1",
      address: null,
    });

    const req: any = {
      headers: { get: () => null },
      cookies: { get: () => ({ value: "token" }) },
      url: "http://localhost/api/surveys/s1/nonrespondents?reminders=1",
    };
    const { GET } = await import(
      "../app/api/surveys/[id]/nonrespondents/route"
    );
    const res: any = await GET(req, { params: Promise.resolve({ id: "s1" }) });
    const body = await res.json();
    // debug: ensure groupBy and response calls were made with expected where clauses
    // console.debug('groupBy called with:', (prisma.reminder as any).groupBy.mock.calls);
    // console.debug('response.findMany calls:', (prisma.response.findMany as any).mock.calls);

    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0].id).toBe("m1");
  });

  it("filters `reminders=0` (returns only members with zero reminders)", async () => {
    (verifyToken as any).mockResolvedValue({ adminId: "admin1" });
    (prisma.survey.findUnique as any).mockResolvedValue({ id: "s1" });

    // responses contain 3 members
    const allResponses2 = [
      {
        id: "resp1",
        token: "token1",
        member: { id: "m1", name: "Jane", email: "j@example.com", lot: "1" },
      },
      {
        id: "resp2",
        token: "token2",
        member: { id: "m2", name: "Bob", email: "b@example.com", lot: "2" },
      },
      {
        id: "resp3",
        token: "token3",
        member: { id: "m3", name: "Ann", email: "a@example.com", lot: "3" },
      },
    ];
    (prisma.response.findMany as any).mockImplementation(async (opts: any) => {
      if (opts && opts.select && opts.select.memberId) {
        return allResponses2.map((r) => ({ memberId: r.member.id }));
      }
      if (opts && opts.where && opts.where.memberId && opts.where.memberId.in) {
        return allResponses2.filter((r) =>
          (opts.where.memberId.in as string[]).includes(r.member.id)
        );
      }
      return allResponses2;
    });

    // groupBy returns reminders per member only for members with 1+ reminders: m1 has 1 reminder
    (prisma.reminder as any).groupBy = vi
      .fn()
      .mockResolvedValue([{ memberId: "m1", _count: { _all: 1 } }]);

    (prisma.reminder as any).count = vi.fn().mockResolvedValue(0);
    (decryptMemberData as any).mockResolvedValue({
      name: "Ann",
      email: "a@example.com",
      lot: "3",
      address: null,
    });

    const req: any = {
      headers: { get: () => null },
      cookies: { get: () => ({ value: "token" }) },
      url: "http://localhost/api/surveys/s1/nonrespondents?reminders=0",
    };
    const { GET } = await import(
      "../app/api/surveys/[id]/nonrespondents/route"
    );
    const res: any = await GET(req, { params: Promise.resolve({ id: "s1" }) });
    const body = await res.json();
    // debug: check called where filters
    // console.debug('response.findMany calls:', (prisma.response.findMany as any).mock.calls);

    expect(Array.isArray(body)).toBe(true);
    // m2 and m3 have 0 reminders (m1 has 1). But we should only return members present in responses non-submitted.
    // Based on our mocked responses, m2 and m3 have 0 reminders and should be returned.
    expect(body.length).toBe(2);
    const ids = body.map((b: any) => b.id).sort();
    expect(ids).toEqual(["m2", "m3"]);
  });
});
