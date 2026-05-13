import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { id: "system" },
    });
    const hoaName = config?.hoaName || process.env.HOA_NAME || "HOA Survey";
    const hoaLogoUrl = config?.hoaLogoUrl || process.env.HOA_LOGO || null;
    return NextResponse.json({ hoaName, hoaLogoUrl });
  } catch (err) {
    return NextResponse.json({
      hoaName: process.env.HOA_NAME || "HOA Survey",
      hoaLogoUrl: process.env.HOA_LOGO || null,
    });
  }
}
