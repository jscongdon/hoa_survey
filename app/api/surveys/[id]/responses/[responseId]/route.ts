import { log, error as logError } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth/jwt';
import crypto from 'crypto';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; responseId: string }> }
) {
  try {
    const { id: surveyId, responseId } = await params;

    // Verify authentication
    const token = req.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user has FULL access
    const admin = await prisma.admin.findUnique({
      where: { id: payload.adminId },
    });

    if (!admin || admin.role !== 'FULL') {
      return NextResponse.json({ error: 'Forbidden - FULL access required' }, { status: 403 });
    }

    // Verify the response exists and belongs to this survey
    const response = await prisma.response.findUnique({
      where: { id: responseId },
    });

    if (!response) {
      return NextResponse.json({ error: 'Response not found' }, { status: 404 });
    }

    if (response.surveyId !== surveyId) {
      return NextResponse.json({ error: 'Response does not belong to this survey' }, { status: 400 });
    }

    // Store member ID before deleting
    const memberId = response.memberId;

    // Delete the response
    await prisma.response.delete({
      where: { id: responseId },
    });

    // Create a new unsubmitted response for the member
    const newToken = crypto.randomBytes(32).toString('hex');
    await prisma.response.create({
      data: {
        surveyId: surveyId,
        memberId: memberId,
        token: newToken,
        submittedAt: null,
      },
    });

    return NextResponse.json({ success: true, message: 'Response deleted successfully and new response created' });
  } catch (error) {
    logError('Error deleting response:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
