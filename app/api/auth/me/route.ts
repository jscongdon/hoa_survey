import { log, error as logError } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";
import { decryptAdminData } from "@/lib/encryption";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await prisma.admin.findUnique({
      where: { id: payload.adminId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    if (!admin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    const decryptedAdmin = await decryptAdminData({
      email: admin.email,
      name: admin.name || "",
    });

    return NextResponse.json({
      adminId: admin.id,
      email: decryptedAdmin.email,
      name: decryptedAdmin.name,
      role: admin.role,
    });
  } catch (error) {
    logError("Error fetching current admin:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin info" },
      { status: 500 }
    );
  }
}
