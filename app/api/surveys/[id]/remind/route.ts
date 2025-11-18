import { log, error as logError } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth/jwt';
import { sendEmail, generateSurveyEmail } from '@/lib/email/send';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let adminId = req.headers.get('x-admin-id');
  if (!adminId) {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = await verifyToken(token as string);
    if (!payload?.adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    adminId = payload.adminId;
  }

  try {
    const { id } = await params;

    // Get survey with responses that haven't been submitted
    const survey = await prisma.survey.findUnique({
      where: { id },
      include: {
        responses: {
          where: { submittedAt: null },
          include: { member: true },
        },
      },
    });

    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    // Check if survey is still open
    if (new Date() > survey.closesAt) {
      return NextResponse.json({ error: 'Survey is closed' }, { status: 400 });
    }

    const pendingResponses = survey.responses;

    log('[REMIND] Survey:', survey.id, survey.title);
    log('[REMIND] Total responses:', survey.responses.length);
    log('[REMIND] Pending (unsubmitted):', pendingResponses.length);
    
    if (pendingResponses.length === 0) {
      return NextResponse.json({ 
        message: 'No pending responses to remind',
        count: 0,
        debug: {
          surveyId: survey.id,
          totalResponses: survey.responses.length,
        }
      });
    }

    // Determine base URL for links
    const isDevelopment = process.env.NODE_ENV === 'development';
    const baseUrl = isDevelopment 
      ? (process.env.DEVELOPMENT_URL || `${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('host')}`)
      : (process.env.PRODUCTION_URL || `${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('host')}`);

    let sent = 0;
    let failed = 0;

    await Promise.all(
      pendingResponses.map(async (response) => {
        try {
          log('[REMIND] Sending to:', response.member.email, 'Token:', response.token);
          
          const link = `${baseUrl}/survey/${response.token}`;
          const html = generateSurveyEmail(
            survey.title,
            survey.description || '',
            link,
            response.member.lot,
            response.member.name
          );

          await sendEmail({
            to: response.member.email,
            subject: `Reminder: ${survey.title}`,
            html,
            text: `Please complete the survey: ${link}`,
          });

          log('[REMIND] Sent successfully to:', response.member.email);

          // Record reminder only on successful send
          await prisma.reminder.create({
            data: {
              surveyId: survey.id,
              memberId: response.memberId,
              sentAt: new Date(),
              reminderNum:
                (await prisma.reminder.count({
                  where: { surveyId: survey.id, memberId: response.memberId },
                })) + 1,
            },
          });

          sent += 1;
        } catch (err) {
          logError('[REMIND] Failed to send reminder to', response.member.email, err);
          failed += 1;
        }
      })
    );

    return NextResponse.json({
      success: true,
      message: `Reminders sent: ${sent}, failed: ${failed}`,
      sent,
      failed,
    });
  } catch (error) {
    logError('Reminder error:', error);
    return NextResponse.json(
      { error: 'Failed to send reminders' },
      { status: 500 }
    );
  }
}
