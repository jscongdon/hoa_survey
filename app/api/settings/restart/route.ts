import { log, error as logError } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    // Check if this is being called during setup (allow unauthenticated)
    const isSetupCall = request.headers.get("x-setup-restart") === "true";

    if (!isSetupCall) {
      // Normal authenticated restart requires FULL role
      const token = request.cookies.get("auth-token")?.value;
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const payload = await verifyToken(token);
      if (!payload?.adminId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Check if admin has FULL role
      const admin = await prisma.admin.findUnique({
        where: { id: payload.adminId },
      });

      if (!admin || admin.role !== "FULL") {
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 }
        );
      }
    }

    // Attempt to restart the application
    try {
      // Get our own hostname (which is the container ID in Docker)
      const { stdout: hostname } = await execAsync("hostname");
      const containerIdOrName = hostname.trim();

      log("Attempting to restart container:", containerIdOrName);

      // Send response BEFORE restarting to avoid connection issues
      // Use setTimeout to delay the actual restart
      setTimeout(async () => {
        try {
          await execAsync(`docker restart ${containerIdOrName}`);
          log("Container restart initiated");
        } catch (error) {
          logError("Restart command error (may be expected):", error);
        }
      }, 1000); // 1 second delay to allow response to be sent

      return NextResponse.json({
        success: true,
        message:
          "Application is restarting. Please wait a moment and refresh the page.",
      });
    } catch (error: any) {
      logError("Error during restart setup:", error);

      // Try alternative: find container by name
      try {
        const { stdout } = await execAsync(
          'docker ps --format "{{.Names}}" | grep -E "hoa_survey|app"'
        );
        const containerName = stdout.trim().split("\n")[0];

        if (containerName) {
          log("Trying restart with container name:", containerName);

          // Send response BEFORE restarting
          setTimeout(async () => {
            try {
              await execAsync(`docker restart ${containerName}`);
              log("Container restart initiated");
            } catch (error) {
              logError("Restart command error (may be expected):", error);
            }
          }, 1000);

          return NextResponse.json({
            success: true,
            message:
              "Application is restarting. Please wait a moment and refresh the page.",
          });
        }
      } catch (fallbackError) {
        logError("Fallback restart also failed:", fallbackError);
      }
    }

    // If we get here, we couldn't restart automatically
    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to restart automatically. Please manually restart the application: docker compose restart",
      },
      { status: 200 }
    );
  } catch (error) {
    logError("Error restarting application:", error);
    return NextResponse.json(
      {
        error: "Failed to restart application. Please restart manually.",
      },
      { status: 500 }
    );
  }
}
