import { log, error as logError } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth/jwt';

export async function DELETE(
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
    log('[DELETE_SURVEY] Starting delete request');
    const { id } = await params;
    log('[DELETE_SURVEY] Survey ID:', id);

    // Check if survey exists
    const survey = await prisma.survey.findUnique({
      where: { id },
      include: {
        responses: true,
        _count: {
          select: {
            responses: true,
            questions: true,
          },
        },
      },
    });

    if (!survey) {
      log('[DELETE_SURVEY] Survey not found:', id);
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    log('[DELETE_SURVEY] Survey found:', {
      id: survey.id,
      title: survey.title,
      responses: survey._count.responses,
      questions: survey._count.questions,
    });

    // Check for submitted responses
    const submittedCount = survey.responses.filter(r => r.submittedAt !== null).length;
    log('[DELETE_SURVEY] Submitted responses count:', submittedCount);

    // Check for force flag
    const forceDelete = req.nextUrl.searchParams.get('force') === 'true';
    log('[DELETE_SURVEY] Force delete:', forceDelete);

    if (forceDelete) {
      try {
        const admin = await prisma.admin.findUnique({ where: { id: adminId } });
        if (!admin || admin.role !== 'FULL') {
          return NextResponse.json({ error: 'Insufficient permissions for forced delete' }, { status: 403 });
        }
        log(`[DELETE_SURVEY] Admin ${adminId} forced delete on survey ${id}`);
      } catch (e) {
        logError('[DELETE_SURVEY] Error fetching admin role for force delete', e);
        return NextResponse.json({ error: 'Insufficient permissions for forced delete' }, { status: 403 });
      }
    }

    if (submittedCount > 0 && !forceDelete) {
      log('[DELETE_SURVEY] Returning 409 - has submitted responses');
      return NextResponse.json({
        error: 'Survey has submitted responses',
        requiresConfirmation: true,
        submittedCount,
        totalResponses: survey._count.responses,
      }, { status: 409 });
    }

    log('[DELETE_SURVEY] Starting transaction delete');

    // Delete survey (cascades to questions, responses via schema; manually delete reminders)
    await prisma.$transaction(async (tx) => {
      // Delete reminders first (not cascade-constrained)
      log('[DELETE_SURVEY] Deleting reminders');
      const deletedReminders = await tx.reminder.deleteMany({
        where: { surveyId: id },
      });
      log('[DELETE_SURVEY] Deleted reminders:', deletedReminders.count);
      
      // Delete survey (cascades to questions and responses)
      log('[DELETE_SURVEY] Deleting survey');
      await tx.survey.delete({
        where: { id },
      });
      log('[DELETE_SURVEY] Survey deleted successfully');
    });

    log('[DELETE_SURVEY] Transaction completed successfully');
    return NextResponse.json({
      success: true,
      message: 'Survey deleted successfully',
    });
  } catch (error: any) {
    logError('[DELETE_SURVEY] ERROR:', error);
    logError('[DELETE_SURVEY] Error stack:', error?.stack);
    logError('[DELETE_SURVEY] Error type:', typeof error);
    logError('[DELETE_SURVEY] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    return NextResponse.json(
      { 
        error: 'Failed to delete survey', 
        details: error?.message || 'Unknown error',
        type: error?.constructor?.name || typeof error
      },
      { status: 500 }
    );
  }
}
