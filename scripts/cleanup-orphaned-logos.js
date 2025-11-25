#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

async function main() {
  try {
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();

    // Get current logo URL from system config
    const config = await prisma.systemConfig.findUnique({
      where: { id: "system" },
    });

    const currentLogoUrl = config?.hoaLogoUrl || null;
    console.log("Current logo URL:", currentLogoUrl);

    // Get all logo files in uploads directory
    const uploadsDir = path.join(process.cwd(), "public", "uploads");

    if (!fs.existsSync(uploadsDir)) {
      console.log("Uploads directory does not exist");
      return;
    }

    const files = fs.readdirSync(uploadsDir);
    const logoFiles = files.filter((file) => file.startsWith("hoa-logo-"));

    console.log(`Found ${logoFiles.length} logo files:`);
    logoFiles.forEach((file) => console.log(`  - ${file}`));

    if (!currentLogoUrl) {
      console.log("No current logo set - all logo files are orphaned");
    }

    // Determine which files to keep vs delete
    let filesToDelete = [];
    let fileToKeep = null;

    if (currentLogoUrl && currentLogoUrl.startsWith("/uploads/")) {
      const expectedFilename = path.basename(currentLogoUrl);
      fileToKeep = expectedFilename;

      filesToDelete = logoFiles.filter((file) => file !== expectedFilename);
      console.log(`Keeping current logo: ${expectedFilename}`);
    } else {
      // No current logo, delete all
      filesToDelete = logoFiles;
      console.log("No current logo - deleting all logo files");
    }

    // Delete orphaned files
    let deletedCount = 0;
    for (const file of filesToDelete) {
      const filePath = path.join(uploadsDir, file);
      try {
        fs.unlinkSync(filePath);
        console.log(`✅ Deleted orphaned logo: ${file}`);
        deletedCount++;
      } catch (error) {
        console.error(`❌ Failed to delete ${file}:`, error.message);
      }
    }

    console.log(`\nCleanup complete:`);
    console.log(`- Files deleted: ${deletedCount}`);
    console.log(`- Files kept: ${fileToKeep ? 1 : 0}`);

    await prisma.$disconnect();
  } catch (error) {
    console.error("Error during logo cleanup:", error);
    process.exit(1);
  }
}

main();
