const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const surveyId = "cmi59ornp0001p640n552gtce";
  const responses = await p.response.findMany({
    where: { surveyId },
    select: {
      id: true,
      token: true,
      submittedAt: true,
      member: { select: { id: true, name: true, email: true } },
    },
  });
  console.log(JSON.stringify(responses, null, 2));
  await p.$disconnect();
})();
