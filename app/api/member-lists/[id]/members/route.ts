import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth/jwt';

export async function POST(
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
    const body = await req.json();
    const { lot, name, email, address } = body;

    // Validate required fields
    if (!lot || !name || !email) {
      return NextResponse.json(
        { error: 'Lot, name, and email are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Verify list exists
    const list = await prisma.memberList.findUnique({
      where: { id },
    });

    if (!list) {
      return NextResponse.json({ error: 'Member list not found' }, { status: 404 });
    }

    // Create the member and connect to the list
    const newMember = await prisma.member.create({
      data: {
        lot,
        name,
        email,
        address: address || '',
        lists: {
          connect: { id },
        },
      },
    });

    // Find all ongoing surveys for this member list
    const now = new Date();
    const ongoingSurveys = await prisma.survey.findMany({
      where: {
        memberListId: id,
        closesAt: {
          gt: now,
        },
      },
    });

    // Create response records for the new member in all ongoing surveys
    for (const survey of ongoingSurveys) {
      // Generate a unique token for this response
      const token = `${survey.id}-${newMember.id}-${Date.now()}`;
      
      await prisma.response.create({
        data: {
          surveyId: survey.id,
          memberId: newMember.id,
          token,
          submittedAt: null,
        },
      });
      
      // If survey has minResponsesAll=true, increment minResponses
      if (survey.minResponsesAll) {
        await prisma.survey.update({
          where: { id: survey.id },
          data: {
            minResponses: {
              increment: 1,
            },
          },
        });
      }
    }

    return NextResponse.json(newMember);
  } catch (error) {
    console.error('[MEMBER_CREATE]', error);
    return NextResponse.json(
      { error: 'Failed to create member' },
      { status: 500 }
    );
  }
}
