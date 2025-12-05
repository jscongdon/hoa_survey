import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/jwt", () => ({
  verifyToken: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    member: { findUnique: vi.fn(), update: vi.fn() },
    response: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/encryption", () => ({
  decryptMemberData: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { decryptMemberData } from "@/lib/encryption";

describe("Member update returns affectedResponses", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns decrypted member and affectedResponses", async () => {
    (verifyToken as any).mockResolvedValue({ adminId: "admin1" });
    (prisma.member.findUnique as any).mockResolvedValue({
      id: "m1",
      lists: [{ id: "list1" }],
    });
    (prisma.member.update as any).mockResolvedValue({
      id: "m1",
      name: "Encrypted Name",
      email: "enc-email",
      lot: "enc-lot",
      address: "enc-address",
    });
    (prisma.response.findMany as any).mockResolvedValue([
      { id: "r1", token: "t1", surveyId: "s1" },
      { id: "r2", token: "t2", surveyId: "s2" },
    ]);
    (decryptMemberData as any).mockResolvedValue({
      name: "John Doe",
      email: "johndoe@example.com",
      lot: "101",
      address: "1 Main St",
    });

    const { PUT } = await import(
      "../app/api/member-lists/[id]/members/[memberId]/route"
    );

    const req: any = {
      headers: { get: () => null },
      cookies: { get: () => ({ value: "token" }) },
      json: async () => ({
        name: "John Doe",
        email: "johndoe@example.com",
        lot: "101",
        address: "1 Main St",
      }),
    };

    const res: any = await PUT(req, {
      params: Promise.resolve({ id: "list1", memberId: "m1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("member");
    expect(body).toHaveProperty("affectedResponses");
    expect(Array.isArray(body.affectedResponses)).toBe(true);
    expect(body.affectedResponses.length).toBe(2);
    expect(body.member.email).toBe("johndoe@example.com");
    expect(body.member.id).toBe("m1");
  });

  it("allows clearing member email by setting it to empty string", async () => {
    (verifyToken as any).mockResolvedValue({ adminId: "admin1" });
    (prisma.member.findUnique as any).mockResolvedValue({
      id: "m1",
      lists: [{ id: "list1" }],
      email: "enc@old.com",
    });
    (prisma.member.update as any).mockResolvedValue({
      id: "m1",
      name: "Encrypted Name",
      email: "",
      lot: "enc-lot",
      address: "enc-address",
    });
    (prisma.response.findMany as any).mockResolvedValue([
      { id: "r1", token: "t1", surveyId: "s1" },
    ]);
    (decryptMemberData as any).mockResolvedValue({
      name: "John Doe",
      email: "",
      lot: "101",
      address: "1 Main St",
    });

    const { PUT } = await import(
      "../app/api/member-lists/[id]/members/[memberId]/route"
    );

    const req: any = {
      headers: { get: () => null },
      cookies: { get: () => ({ value: "token" }) },
      json: async () => ({
        name: "John Doe",
        email: "",
        lot: "101",
        address: "1 Main St",
      }),
    };

    const res: any = await PUT(req, {
      params: Promise.resolve({ id: "list1", memberId: "m1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("member");
    expect(body).toHaveProperty("affectedResponses");
    expect(body.member.email).toBe("");
  });
});
