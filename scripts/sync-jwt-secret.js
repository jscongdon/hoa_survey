#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

async function main() {
  try {
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    const config = await prisma.systemConfig.findUnique({
      where: { id: "system" },
    });
    await prisma.$disconnect();

    if (!config || !config.jwtSecret) {
      console.log("[sync-jwt] no jwtSecret found in database; skipping");
      return;
    }

    const envPath = path.resolve(process.cwd(), ".env.local");
    let current = "";
    try {
      current = fs.readFileSync(envPath, "utf8");
    } catch (err) {
      // file may not exist
      current = "";
    }

    const desiredLine = `JWT_SECRET=${config.jwtSecret}`;

    // If file already contains the exact secret, do nothing
    if (current.includes(desiredLine)) {
      console.log("[sync-jwt] .env.local already up-to-date");
      return;
    }

    // Remove any existing JWT_SECRET lines and append desired one
    let newContent = current.replace(/^JWT_SECRET=.*$/m, "").trimEnd();
    if (newContent.length > 0) newContent += "\n";
    newContent += desiredLine + "\n";

    fs.writeFileSync(envPath, newContent, { encoding: "utf8", mode: 0o600 });
    console.log("[sync-jwt] wrote .env.local with JWT_SECRET");
  } catch (err) {
    console.error(
      "[sync-jwt] error syncing secret:",
      err instanceof Error ? err.message : err
    );
    // don't throw - this is best-effort
  }
}

main();
