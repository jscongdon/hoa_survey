const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const password = "TempPass123!";
  const hashed = await bcrypt.hash(password, 10);

  const existing = await prisma.admin.findUnique({
    where: { email: "admin@hoasurvey.local" },
  });
  if (!existing) {
    await prisma.admin.create({
      data: {
        email: "admin@hoasurvey.local",
        password: hashed,
        name: "Initial Admin",
        role: "FULL",
      },
    });
    console.log("Seeded admin: admin@hoasurvey.local /", password);
  } else {
    console.log("Admin already exists");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
