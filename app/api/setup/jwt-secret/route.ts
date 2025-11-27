import { log, error as logError } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    // Check if JWT_SECRET is set in environment
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret || jwtSecret === "dev-secret-will-be-replaced-by-setup") {
      return NextResponse.json(
        {
          error: "JWT_SECRET environment variable not set",
          instructions:
            "Set JWT_SECRET in your environment variables. Generate a secure secret with: openssl rand -hex 64",
        },
        { status: 404 }
      );
    }

    // Return status about JWT secret (mask the actual value for security)
    return NextResponse.json({
      jwtSecretSet: true,
      jwtSecretLength: jwtSecret.length,
      instructions:
        "JWT_SECRET is properly configured in environment variables",
    });
  } catch (error: any) {
    logError("Error checking JWT secret:", error);
    return NextResponse.json(
      { error: "Failed to check JWT secret configuration" },
      { status: 500 }
    );
  }
}
