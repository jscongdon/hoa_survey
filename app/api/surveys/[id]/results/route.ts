import { log, error as logError } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token.value);
    if (!payload?.adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Fetch survey with questions and responses
    const survey = await prisma.survey.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
        responses: {
          where: {
            submittedAt: { not: null },
          },
          include: {
            member: true,
            answers: true,
          },
        },
        memberList: true,
      },
    });

    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    // Convert answers array to object with questionId as key
    const responses = survey.responses.map((response) => ({
      id: response.id,
      member: {
        lot: response.member.lot,
        name: response.member.name,
      },
      answers: response.answers.reduce((acc, answer) => {
        // Parse arrays stored as JSON strings
        try {
          acc[answer.questionId] = JSON.parse(answer.value);
        } catch {
          acc[answer.questionId] = answer.value;
        }
        return acc;
      }, {} as Record<string, any>),
      submittedAt: response.submittedAt,
    }));

    log('[RESULTS] Survey questions:', JSON.stringify(survey.questions.map(q => ({ id: q.id, text: q.text, type: q.type })), null, 2));
    log('[RESULTS] Total responses:', responses.length);
    log('[RESULTS] Response answers:', JSON.stringify(responses.map(r => r.answers), null, 2));

    // Calculate statistics for each question
    const questionStats = survey.questions.map((question, questionIndex) => {
      // Collect answers by question ID
      const questionAnswers = responses
        .map(response => response.answers[question.id])
        .filter(answer => {
          // Filter out empty answers
          if (answer === undefined || answer === null || answer === '') return false;
          if (Array.isArray(answer) && answer.length === 0) return false;
          return true;
        });

      log(`[RESULTS] Question ${question.id} "${question.text}" (${question.type}):`, 
        `Found ${questionAnswers.length} answers out of ${responses.length} total responses`,
        questionAnswers);

      let stats: any = {
        questionId: question.id,
        text: question.text,
        type: question.type,
        totalResponses: questionAnswers.length,
        responseRate: survey.responses.length > 0 
          ? Math.round((questionAnswers.length / survey.responses.length) * 100) 
          : 0,
      };

      if (question.type === 'YES_NO' || question.type === 'MULTI_SINGLE') {
        // Count occurrences of each option
        const counts: Record<string, number> = {};
        questionAnswers.forEach((answer) => {
          const value = String(answer);
          counts[value] = (counts[value] || 0) + 1;
        });
        stats.counts = counts;
      } else if (question.type === 'MULTI_MULTI') {
        // Count occurrences of each option (answers are arrays)
        const counts: Record<string, number> = {};
        questionAnswers.forEach((answer) => {
          if (Array.isArray(answer)) {
            answer.forEach((option) => {
              counts[option] = (counts[option] || 0) + 1;
            });
          }
        });
        stats.counts = counts;
      } else if (question.type === 'RATING_5') {
        // Calculate average and distribution
        const ratings = questionAnswers.map((a) => Number(a));
        const sum = ratings.reduce((acc, val) => acc + val, 0);
        const average = ratings.length > 0 ? sum / ratings.length : 0;
        const counts: Record<string, number> = {};
        ratings.forEach((rating) => {
          counts[String(rating)] = (counts[String(rating)] || 0) + 1;
        });
        stats.average = Math.round(average * 10) / 10;
        stats.counts = counts;
      } else if (question.type === 'PARAGRAPH') {
        // Just return all text responses
        stats.responses = questionAnswers;
      }

      return stats;
    });

    return NextResponse.json({
      survey: {
        id: survey.id,
        title: survey.title,
        description: survey.description,
        opensAt: survey.opensAt,
        closesAt: survey.closesAt,
        totalResponses: survey.responses.length,
      },
      questions: survey.questions.map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        options: q.options ? JSON.parse(q.options) : null,
        required: (q as any).required || false,
      })),
      stats: questionStats,
      responses,
    });
  } catch (error) {
    logError('Error fetching survey results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch survey results' },
      { status: 500 }
    );
  }
}
