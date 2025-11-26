const { PrismaClient } = require("@prisma/client");
const {
  encryptMemberData: encryptMemberDataFn,
} = require("../lib/encryption.ts");

const prisma = new PrismaClient();

async function encryptExistingMemberData() {
  console.log("Starting member data encryption migration...");

  try {
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

      const encryptedData = await encryptMemberDataFn({
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

      console.log(`Encrypted data for member ${member.id}`);
      encryptedCount++;
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
