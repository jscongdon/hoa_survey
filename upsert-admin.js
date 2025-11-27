const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const fs = require("fs");

async function main(){
  const env = fs.readFileSync("/app/.env","utf8");
  const emailMatch = env.match(/ADMIN_EMAIL=(?:\"?)([^\"\n]*)/);
  const passMatch = env.match(/ADMIN_PASSWORD=(?:\"?)([^\"\n]*)/);
  const nameMatch = env.match(/ADMIN_NAME=(?:\"?)([^\"\n]*)/);
  if(!emailMatch || !passMatch) { console.error('ADMIN_EMAIL or ADMIN_PASSWORD not found in /app/.env'); process.exit(1); }
  const email = emailMatch[1].replace(/^\"|\"$/g, '');
  const password = passMatch[1].replace(/^\"|\"$/g, '');
  const name = nameMatch ? nameMatch[1].replace(/^\"|\"$/g, '') : 'Admin';

  const prisma = new PrismaClient();
  const hash = await bcrypt.hash(password, 12);

  await prisma.admin.upsert({
    where: { email },
    update: { password: hash, name, role: 'FULL' },
    create: { email, password: hash, name, role: 'FULL' }
  });

  console.log('Upserted admin:', email);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
