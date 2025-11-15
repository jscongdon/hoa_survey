import { log, error as logError } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
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

    const { id } = await context.params;

    // Fetch all responses for this survey where submittedAt is null
    const nonRespondents = await prisma.response.findMany({
      where: {
        surveyId: id,
        submittedAt: null,
      },
      include: {
        member: {
          select: {
            id: true,
            name: true,
            lot: true,
          },
        },
      },
    });

    // Format the response - parse name to get first/last and lot number
    const formattedNonRespondents = nonRespondents.map((response) => {
      const nameParts = response.member.name.split(' ');
      const firstName = nameParts.slice(0, -1).join(' ') || response.member.name;
      const lastName = nameParts[nameParts.length - 1] || '';
      
      return {
        responseId: response.id,
        id: response.member.id,
        firstName,
        lastName,
        lotNumber: response.member.lot,
      };
    });

    // Sort by lot number (assuming lot is a string that may contain numbers)
    formattedNonRespondents.sort((a, b) => {
      const lotA = parseInt(a.lotNumber) || 0;
      const lotB = parseInt(b.lotNumber) || 0;
      return lotA - lotB;
    });

    return NextResponse.json(formattedNonRespondents);
  } catch (error) {
    logError('[NON_RESPONDENTS_GET]', error);
    return NextResponse.json(
      { error: 'Failed to fetch non-respondents' },
      { status: 500 }
    );
  }
}
