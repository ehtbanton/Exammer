import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// Helper to check if user is a teacher of the class
async function isClassTeacher(classId: number, userId: number): Promise<boolean> {
  const membership = await db.get<{ role: string; status: string }>(
    `SELECT role, status FROM class_memberships
     WHERE class_id = ? AND user_id = ? AND role = 'teacher' AND status = 'approved'`,
    [classId, userId]
  );

  return !!membership;
}

// POST /api/classes/[id]/members/[userId]/approve - Approve or reject a join request
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id, userId } = await params;
    const classId = parseInt(id);
    const targetUserId = parseInt(userId);

    if (isNaN(classId) || isNaN(targetUserId)) {
      return NextResponse.json({ error: 'Invalid class ID or user ID' }, { status: 400 });
    }

    // Check if user is a teacher of this class
    const isTeacher = await isClassTeacher(classId, user.id);

    if (!isTeacher) {
      return NextResponse.json(
        { error: 'Only teachers can approve or reject join requests' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action } = body; // 'approve' or 'reject'

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be either "approve" or "reject"' },
        { status: 400 }
      );
    }

    // Check if the membership exists and is pending
    const membership = await db.get<{ status: string; role: string }>(
      'SELECT status, role FROM class_memberships WHERE class_id = ? AND user_id = ?',
      [classId, targetUserId]
    );

    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
    }

    if (membership.status !== 'pending') {
      return NextResponse.json(
        { error: `This request has already been ${membership.status}` },
        { status: 400 }
      );
    }

    // Update the membership status
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await db.run(
      'UPDATE class_memberships SET status = ? WHERE class_id = ? AND user_id = ?',
      [newStatus, classId, targetUserId]
    );

    return NextResponse.json({
      message: `Join request ${newStatus} successfully`,
      status: newStatus
    });
  } catch (error: any) {
    console.error('Error updating membership:', error);
    return NextResponse.json({ error: error.message || 'Failed to update membership' }, { status: 500 });
  }
}
