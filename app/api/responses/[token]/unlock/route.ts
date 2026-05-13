import { log, error as logError } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const token = request.cookies.get("auth-token")?.value;
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload?.adminId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // ensure admin has FULL role
    const admin = await prisma.admin.findUnique({
      where: { id: payload.adminId },
    });
    if (!admin || admin.role !== "FULL")
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );

    const { token: responseToken } = await params;

    const existing = await prisma.response.findUnique({
      where: { token: responseToken },
    });
    if (!existing)
      return NextResponse.json(
        { error: "Response not found" },
        { status: 404 }
      );

    // Only a signed response is meaningful to unlock; if not signed, return 200 no-op
    if (!existing.signed) {
      return NextResponse.json({
        ok: true,
        message: "Response already editable",
        response: existing,
      });
    }

    const updated = await prisma.response.update({
      where: { token: responseToken },
      data: { signed: false, signedAt: null, signatureToken: null },
    });

    // Optionally: log admin action (server logs)
    log(`Admin ${payload.adminId} unlocked response ${updated.id}`);

    return NextResponse.json({ ok: true, response: updated });
  } catch (err) {
    logError("Failed to unlock response:", err);
    return NextResponse.json(
      { error: "Failed to unlock response" },
      { status: 500 }
    );
  }
}
