const { PrismaClient } = require("@prisma/client");
const { encryptMemberData } = require("../lib/encryption.ts");

const prisma = new PrismaClient();

async function encryptExistingMemberData() {
  console.log("Starting member data encryption migration...");

  try {
    // Load JWT secret from database and set as environment variable
    const config = await prisma.systemConfig.findUnique({
      where: { id: "system" },
    });

    if (!config?.jwtSecret) {
      throw new Error(
        "JWT_SECRET not found in database. Please run setup first."
      );
    }

    process.env.JWT_SECRET = config.jwtSecret;
    console.log("Loaded JWT secret from database for encryption");

    // Get all members
    const members = await prisma.member.findMany();

    console.log(`Found ${members.length} members to check for encryption`);

    let encryptedCount = 0;
    let skippedCount = 0;

    // Encrypt each member's data (only if not already encrypted)
    for (const member of members) {
      // Skip if data appears to already be encrypted (starts with hex characters)
      const isEncrypted =
        /^[a-f0-9]{64,}/.test(member.name) ||
        /^[a-f0-9]{64,}/.test(member.email);

      if (isEncrypted) {
        console.log(`Skipping already encrypted member ${member.id}`);
        skippedCount++;
        continue;
      }

      console.log(
        `Processing member ${member.id}: name="${member.name}", email="${member.email}"`
      );

      try {
        const encryptedData = await encryptMemberData({
          name: member.name,
          email: member.email,
          address: member.address || "",
          lot: member.lot,
        });

        console.log(
          `Encrypted member ${member.id}: name="${encryptedData.name}", email="${encryptedData.email}"`
        );

        await prisma.member.update({
          where: { id: member.id },
          data: {
            name: encryptedData.name,
            email: encryptedData.email,
            address: encryptedData.address,
            lot: encryptedData.lot,
          },
        });

        console.log(`Updated member ${member.id} in database`);
        encryptedCount++;
      } catch (error) {
        console.error(`Failed to encrypt member ${member.id}:`, error);
        throw error;
      }
    }

    console.log("Member data encryption migration completed successfully");
    console.log(
      `Encrypted ${encryptedCount} members, skipped ${skippedCount} already encrypted members`
    );
  } catch (error) {
    console.error("Error during member data encryption migration:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  encryptExistingMemberData()
    .then(() => {
      console.log("Migration completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

module.exports = { encryptExistingMemberData };
