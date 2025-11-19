const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const cfg = await p.systemConfig.findUnique({ where: { id: 'system' } });
  console.log('systemConfig:', JSON.stringify(cfg, null, 2));
  console.log('\nEnvironment SMTP envs:');
  console.log('SMTP_HOST=', process.env.SMTP_HOST || '<not set>');
  console.log('SMTP_PORT=', process.env.SMTP_PORT || '<not set>');
  console.log('SMTP_USER=', process.env.SMTP_USER ? '***' : '<not set>');
  console.log('SMTP_PASS=', process.env.SMTP_PASS ? '***' : '<not set>');
  console.log('SMTP_FROM=', process.env.SMTP_FROM || '<not set>');
  console.log('HOA_NAME=', process.env.HOA_NAME || '<not set>');
  await p.$disconnect();
})();
