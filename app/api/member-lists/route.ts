import { log, error as logError } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import Papa from "papaparse";
import { encryptMemberData, decryptMemberData } from "@/lib/encryption";

export async function GET(request: NextRequest) {
  let adminId = request.headers.get("x-admin-id");

  if (!adminId) {
    const token = request.cookies.get("auth-token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const payload = await verifyToken(token as string);
    if (!payload?.adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    adminId = payload.adminId;
  }

  const lists = await prisma.memberList.findMany({
    include: { _count: { select: { members: true, surveys: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Transform prefixed strings back to Date objects
  const transformedLists = lists.map((list) => ({
    ...list,
    createdAt:
      typeof list.createdAt === "string" && list.createdAt.startsWith("DT:")
        ? new Date(list.createdAt.substring(3))
        : list.createdAt,
  }));

  return NextResponse.json(transformedLists);
}

export async function POST(request: NextRequest) {
  let adminId = request.headers.get("x-admin-id");

  if (!adminId) {
    const token = request.cookies.get("auth-token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const payload = await verifyToken(token as string);
    if (!payload?.adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    adminId = payload.adminId;
  }

  try {
    const formData = await request.formData();
    const name = formData.get("name") as string;
    const csvFile = formData.get("csv") as File;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    let members: Array<{
      lot: string;
      name: string;
      email: string;
      address?: string;
    }> = [];

    if (csvFile) {
      const csvText = await csvFile.text();
      const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
      });

      members = parsed.data as typeof members;

      // Validate email format for all members
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = members.filter(
        (m) => m.email && !emailRegex.test(m.email)
      );

      if (invalidEmails.length > 0) {
        return NextResponse.json(
          {
            error: "Invalid email format detected",
            details: `Found ${invalidEmails.length} invalid email(s). Please check your CSV file.`,
          },
          { status: 400 }
        );
      }
    }

    const now = new Date();
    // Transform Date to prefixed string to prevent SQLite integer conversion
    const prefixedNow = `DT:${now.toISOString()}`;
    const memberList = await prisma.memberList.create({
      data: {
        name,
        createdAt: prefixedNow,
        members: {
          create: members.map((m) => {
            // Encrypt sensitive member data
            const encryptedData = encryptMemberData({
              name: m.name,
              email: m.email,
              address: m.address || "",
              lot: m.lot,
            });

            return {
              lot: encryptedData.lot,
              name: encryptedData.name,
              email: encryptedData.email,
              address: encryptedData.address,
              createdAt: prefixedNow,
            };
          }),
        },
      },
      include: { _count: { select: { members: true, surveys: true } } },
    });

    // Transform the result back to Date objects for the API response
    const transformedResult = {
      ...memberList,
      createdAt: now,
      members: memberList.members?.map((member) => ({
        ...member,
        createdAt: now,
      })),
    };

    return NextResponse.json(memberList, { status: 201 });
  } catch (error) {
    logError(error);
    return NextResponse.json(
      { error: "Failed to create member list" },
      { status: 500 }
    );
  }
}
