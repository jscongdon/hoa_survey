import { log, error as logError } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { decryptMemberData } from "@/lib/encryption";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const list = await prisma.memberList.findUnique({
    where: { id },
    include: { members: true },
  });

  if (!list) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Decrypt member data before returning
  const decryptedMembers = await Promise.all(
    list.members.map(async (member) => {
      try {
        const decryptedData = await decryptMemberData({
          name: member.name,
          email: member.email,
          address: member.address || "",
          lot: member.lot,
        });

        return {
          ...member,
          name: decryptedData.name,
          email: decryptedData.email,
          address: decryptedData.address,
          lot: decryptedData.lot,
          createdAt:
            typeof member.createdAt === "string" &&
            member.createdAt.startsWith("DT:")
              ? new Date(member.createdAt.substring(3))
              : member.createdAt,
        };
      } catch (error) {
        // If decryption fails, return encrypted data (for backward compatibility)
        logError("Failed to decrypt member data:", error);
        return {
          ...member,
          createdAt:
            typeof member.createdAt === "string" &&
            member.createdAt.startsWith("DT:")
              ? new Date(member.createdAt.substring(3))
              : member.createdAt,
        };
      }
    })
  );

  const decryptedList = {
    ...list,
    createdAt:
      typeof list.createdAt === "string" && list.createdAt.startsWith("DT:")
        ? new Date(list.createdAt.substring(3))
        : list.createdAt,
    members: decryptedMembers,
  };

  return NextResponse.json(decryptedList);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const list = await prisma.memberList.update({
      where: { id },
      data: { name: name.trim() },
      include: { _count: { select: { members: true, surveys: true } } },
    });

    return NextResponse.json(list);
  } catch (error) {
    logError(error);
    return NextResponse.json(
      { error: "Failed to update member list" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    // Delete the member list (database constraints will clean up relationships)
    await prisma.memberList.delete({
      where: { id },
    });

    // Clean up orphaned members that have no responses
    await prisma.member.deleteMany({
      where: {
        lists: { none: {} }, // No lists
        responses: { none: {} }, // No responses
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError(error);
    return NextResponse.json(
      { error: "Failed to delete member list" },
      { status: 500 }
    );
  }
}
