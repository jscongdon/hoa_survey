const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const p = new PrismaClient();

(async () => {
  const surveys = await p.survey.findMany({
    where: { notifyOnMinResponses: true, minimalNotifiedAt: null, createdById: { not: null } },
    include: {
      createdBy: true,
      responses: { where: { submittedAt: { not: null } }, include: { answers: true } },
      questions: { orderBy: { order: 'asc' } },
    },
  });

  if (!surveys || surveys.length === 0) {
    console.log('No surveys found with notifyOnMinResponses=true and minimalNotifiedAt=null');
    await p.$disconnect();
    return;
  }

  for (const s of surveys) {
    console.log('\n---\nSurvey:', s.id, s.title);
    console.log('minResponses:', s.minResponses, 'submitted:', s.responses.length, 'createdBy:', s.createdBy?.email);
    if (s.minResponses && s.responses.length >= s.minResponses) {
      console.log('=> Threshold reached — rendering email HTML');

      const responses = s.responses.map((r) => ({
        id: r.id,
        answers: r.answers.reduce((acc, answer) => {
          try {
            acc[answer.questionId] = JSON.parse(answer.value);
          } catch (e) {
            acc[answer.questionId] = answer.value;
          }
          return acc;
        }, {}),
      }));

      const questionStats = s.questions.map((q) => {
        const questionAnswers = responses
          .map((r) => r.answers[q.id])
          .filter((a) => a !== undefined && a !== null && a !== '')
          .filter((a) => !(Array.isArray(a) && a.length === 0));

        const stats = { questionId: q.id, text: q.text, type: q.type, totalResponses: questionAnswers.length };

        if (q.type === 'YES_NO' || q.type === 'MULTI_SINGLE') {
          const counts = {};
          questionAnswers.forEach((answer) => {
            if (answer && typeof answer === 'object' && answer.choice === '__WRITE_IN__') {
              const writeText = String(answer.writeIn || '').trim();
              const key = writeText !== '' ? writeText : 'Other';
              counts[key] = (counts[key] || 0) + 1;
            } else {
              const key = String(answer);
              counts[key] = (counts[key] || 0) + 1;
            }
          });
          stats.counts = counts;
        } else if (q.type === 'MULTI_MULTI') {
          const counts = {};
          questionAnswers.forEach((answer) => {
            if (Array.isArray(answer)) {
              answer.forEach((opt) => {
                if (opt && typeof opt === 'object' && opt.choice === '__WRITE_IN__') {
                  const writeText = String(opt.writeIn || '').trim();
                  const key = writeText !== '' ? writeText : 'Other';
                  counts[key] = (counts[key] || 0) + 1;
                } else {
                  const key = String(opt);
                  counts[key] = (counts[key] || 0) + 1;
                }
              });
            }
          });
          stats.counts = counts;
        } else if (q.type === 'RATING_5') {
          const ratings = questionAnswers.map((a) => Number(a));
          const sum = ratings.reduce((acc, v) => acc + v, 0);
          const avg = ratings.length > 0 ? sum / ratings.length : 0;
          const counts = {};
          ratings.forEach((rating) => {
            counts[String(rating)] = (counts[String(rating)] || 0) + 1;
          });
          stats.average = Math.round(avg * 10) / 10;
          stats.counts = counts;
        } else if (q.type === 'PARAGRAPH') {
          stats.responses = questionAnswers;
        }

        return stats;
      });

      let summaryHtml = `<p>The survey <strong>${s.title}</strong> has reached its minimal response threshold of <strong>${s.minResponses}</strong>. Here is a brief summary of results so far:</p>`;
      questionStats.forEach((qs) => {
        summaryHtml += `<h4 style=\"margin:0 0 6px 0\">${qs.text}</h4>`;
        if (qs.counts) {
          summaryHtml += `<ul style=\"margin:0 0 12px 18px\">`;
          const entries = Object.entries(qs.counts || {});
          entries.sort((a, b) => {
            const diff = (b[1] || 0) - (a[1] || 0);
            if (diff !== 0) return diff;
            return String(a[0]).localeCompare(String(b[0]));
          });
          entries.forEach(([k, v]) => {
            summaryHtml += `<li>${k}: ${v}</li>`;
          });
          summaryHtml += `</ul>`;
        } else if (qs.responses) {
          summaryHtml += `<ul style=\"margin:0 0 12px 18px\">`;
          qs.responses.slice(0, 10).forEach((r) => {
            summaryHtml += `<li>${String(r)}</li>`;
          });
          summaryHtml += `</ul>`;
        } else if (qs.average !== undefined) {
          summaryHtml += `<p style=\"margin:0 0 12px 0\">Average: ${qs.average} (${qs.totalResponses} responses)</p>`;
        } else {
          summaryHtml += `<p style=\"margin:0 0 12px 0\">${qs.totalResponses} responses</p>`;
        }
      });

      const notifyUrl = (process.env.PRODUCTION_URL || process.env.DEVELOPMENT_URL || 'http://localhost:3000') + `/dashboard/surveys/${s.id}/results`;
      const emailHtml = `\n<div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 8px;\">\n  <h2 style=\"color: #2563eb; margin-bottom: 6px;\">Survey Reached Minimal Responses: ${s.title}</h2>\n  Hello ${s.createdBy.name},\n  <div style=\"margin-top: 12px;\">${summaryHtml}<p style=\"margin-top:12px\"><a href=\"${notifyUrl}\" style=\"color:#2563eb; text-decoration:none\">View full results</a></p></div>\n  <hr style=\"margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;\" />\n  <p style=\"color: #6b7280; font-size: 12px;\">This is an automated notification.</p>\n</div>\n`;
      console.log('--- EMAIL HTML START ---');
      console.log(emailHtml);
      console.log('--- EMAIL HTML END ---');

      // Attempt to send email using SMTP settings from SystemConfig
      try {
        const cfg = await p.systemConfig.findUnique({ where: { id: 'system' } });
        const smtpHost = cfg?.smtpHost;
        const smtpPort = cfg?.smtpPort;
        const smtpUser = cfg?.smtpUser;
        const smtpPass = cfg?.smtpPass;
        const smtpFrom = cfg?.smtpFrom || (cfg?.hoaName ? `${cfg.hoaName} <no-reply@localhost>` : 'no-reply@localhost');

        if (!smtpHost) {
          console.log('SMTP not configured in SystemConfig; skipping send.');
        } else {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort || 587,
            secure: smtpPort === 465,
            auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
          });

          const info = await transporter.sendMail({
            from: smtpFrom,
            to: s.createdBy.email,
            subject: `Survey reached minimal responses: ${s.title}`,
            html: emailHtml,
          });

          console.log('Email sent:', info.messageId || info.response || info);

          // Mark survey as notified to avoid duplicates
          await p.survey.update({ where: { id: s.id }, data: { minimalNotifiedAt: new Date() } });
          console.log('Survey marked as notified:', s.id);
        }
      } catch (sendErr) {
        console.error('Failed to send notification email:', sendErr);
      }
    } else {
      console.log('=> Threshold not yet reached or missing minResponses');
    }
  }

  await p.$disconnect();
})();
