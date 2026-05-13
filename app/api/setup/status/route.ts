import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { id: "system" },
    });

    const adminCount = await prisma.admin.count();

    // No debug logging in production

    return NextResponse.json({
      setupCompleted: config?.setupCompleted || false,
      adminExists: adminCount > 0,
      developmentMode: config?.developmentMode ?? false,
    });
  } catch (error) {
    return NextResponse.json({
      setupCompleted: false,
      adminExists: false,
    });
  }
}
