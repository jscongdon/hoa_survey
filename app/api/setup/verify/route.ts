import { log, error as logError } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const email = searchParams.get("email");

    if (!token || !email) {
      return NextResponse.redirect(
        new URL("/setup?error=invalid-link", req.url)
      );
    }

    // Check verification token
    const pendingVerifications =
      (global as any).pendingVerifications || new Map();
    const verification = pendingVerifications.get(token);

    if (!verification || verification.email !== email) {
      return NextResponse.redirect(
        new URL("/setup?error=invalid-token", req.url)
      );
    }

    if (Date.now() > verification.expires) {
      pendingVerifications.delete(token);
      return NextResponse.redirect(
        new URL("/setup?error=expired-token", req.url)
      );
    }

    // Update admin role to FULL and mark setup as complete
    const config = await prisma.$transaction(async (tx) => {
      await tx.admin.update({
        where: { email },
        data: { role: "FULL" },
      });

      const updatedConfig = await tx.systemConfig.update({
        where: { id: "system" },
        data: {
          setupCompleted: true,
          developmentMode: false, // Disable development mode after setup
        },
      });

      return updatedConfig;
    });

    // Clean up verification token
    pendingVerifications.delete(token);

    // Log instructions for JWT secret environment variable (Docker deployments)
    log("=".repeat(80));
    log(
      "IMPORTANT: Ensure this environment variable is set in your container:"
    );
    log("JWT_SECRET=<your-secure-random-secret>");
    log("=".repeat(80));
    log(
      "For Portainer: Go to your stack, edit, add the JWT_SECRET environment variable, and redeploy."
    );
    log("Generate a secure secret using: openssl rand -hex 64");
    log("=".repeat(80));

    // Redirect to login with success message
    return NextResponse.redirect(new URL("/login?verified=true", req.url));
  } catch (error: any) {
    logError("Verification error:", error);
    return NextResponse.redirect(
      new URL("/setup?error=verification-failed", req.url)
    );
  }
}
