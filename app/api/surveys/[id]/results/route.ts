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
          },
        },
        memberList: true,
      },
    });

    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    // Parse answers from each response
    const responses = survey.responses.map((response) => ({
      id: response.id,
      member: {
        lot: response.member.lot,
        name: response.member.name,
      },
      answers: JSON.parse(response.answers as string),
      submittedAt: response.submittedAt,
    }));

    console.log('[RESULTS] Survey questions:', JSON.stringify(survey.questions.map(q => ({ id: q.id, text: q.text, type: q.type })), null, 2));
    console.log('[RESULTS] Total responses:', responses.length);
    console.log('[RESULTS] Response answers:', JSON.stringify(responses.map(r => r.answers), null, 2));

    // Calculate statistics for each question
    const questionStats = survey.questions.map((question, questionIndex) => {
      // Try to get answers by question ID
      let questionAnswers = responses
        .map((r) => r.answers[question.id])
        .filter((a) => {
          if (a === undefined || a === null || a === '') return false;
          if (Array.isArray(a)) return a.length > 0;
          return true;
        });

      // If no answers found by ID, and we have responses, try to match by order
      // This handles cases where question IDs changed after responses were submitted
      if (questionAnswers.length === 0 && responses.length > 0) {
        questionAnswers = responses
          .map((r) => {
            const answerKeys = Object.keys(r.answers);
            // If response has answers, use the answer at the same index as the question
            if (answerKeys.length > questionIndex) {
              return r.answers[answerKeys[questionIndex]];
            }
            return undefined;
          })
          .filter((a) => {
            if (a === undefined || a === null || a === '') return false;
            if (Array.isArray(a)) return a.length > 0;
            return true;
          });
      }

      console.log(`[RESULTS] Question ${question.id} (${question.type}):`, questionAnswers);

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
    console.error('Error fetching survey results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch survey results' },
      { status: 500 }
    );
  }
}
