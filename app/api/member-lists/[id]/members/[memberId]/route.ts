import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth/jwt';

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; memberId: string }> }
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

    const { id, memberId } = await context.params;
    const body = await req.json();
    const { lot, name, email, address } = body;

    // Validate email format if provided
    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
      }
    }

    // Verify member belongs to this list
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: { lists: true },
    });

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const belongsToList = member.lists.some((list) => list.id === id);
    if (!belongsToList) {
      return NextResponse.json({ error: 'Member does not belong to this list' }, { status: 400 });
    }

    // Update the member
    const updatedMember = await prisma.member.update({
      where: { id: memberId },
      data: {
        lot: lot || member.lot,
        name: name || member.name,
        email: email || member.email,
        address: address !== undefined ? address : member.address,
      },
    });

    return NextResponse.json(updatedMember);
  } catch (error) {
    console.error('[MEMBER_UPDATE]', error);
    return NextResponse.json(
      { error: 'Failed to update member' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; memberId: string }> }
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

    const { id, memberId } = await context.params;

    // Verify member belongs to this list
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: { lists: true },
    });

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const belongsToList = member.lists.some((list) => list.id === id);
    if (!belongsToList) {
      return NextResponse.json({ error: 'Member does not belong to this list' }, { status: 400 });
    }

    // Delete all responses for this member in surveys associated with this list
    await prisma.response.deleteMany({
      where: {
        memberId: memberId,
        survey: {
          memberListId: id,
        },
      },
    });

    // Disconnect member from this list
    await prisma.member.update({
      where: { id: memberId },
      data: {
        lists: {
          disconnect: { id },
        },
      },
    });

    // If member is not in any other lists, delete the member entirely
    const updatedMember = await prisma.member.findUnique({
      where: { id: memberId },
      include: { lists: true },
    });

    if (updatedMember && updatedMember.lists.length === 0) {
      await prisma.member.delete({
        where: { id: memberId },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[MEMBER_DELETE]', error);
    return NextResponse.json(
      { error: 'Failed to delete member' },
      { status: 500 }
    );
  }
}
