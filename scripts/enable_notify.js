const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  try {
    const id = process.argv[2] || process.env.SURVEY_ID || 'cmi59ornp0001p640n552gtce';
    const s = await p.survey.update({ where: { id }, data: { notifyOnMinResponses: true, minimalNotifiedAt: null } });
    console.log('Updated survey:', s.id, 'notifyOnMinResponses=', s.notifyOnMinResponses, 'minimalNotifiedAt=', s.minimalNotifiedAt);
    await p.$disconnect();
  } catch (e) {
    console.error('ERROR updating survey:', e);
    try { await p.$disconnect(); } catch (e2) {}
    process.exit(1);
  }
})();
