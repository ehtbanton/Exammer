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

// DELETE /api/classes/[id]/members/[userId] - Remove a member from the class
export async function DELETE(
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
        { error: 'Only teachers can remove members from the class' },
        { status: 403 }
      );
    }

    // Check if the membership exists
    const membership = await db.get<{ role: string }>(
      'SELECT role FROM class_memberships WHERE class_id = ? AND user_id = ?',
      [classId, targetUserId]
    );

    if (!membership) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Prevent removing teachers (including themselves) via this endpoint
    if (membership.role === 'teacher') {
      return NextResponse.json(
        { error: 'Cannot remove teachers from the class. Teachers must leave voluntarily or delete the class.' },
        { status: 400 }
      );
    }

    // Remove the member
    await db.run(
      'DELETE FROM class_memberships WHERE class_id = ? AND user_id = ?',
      [classId, targetUserId]
    );

    return NextResponse.json({
      message: 'Member removed successfully'
    });
  } catch (error: any) {
    console.error('Error removing member:', error);
    return NextResponse.json({ error: error.message || 'Failed to remove member' }, { status: 500 });
  }
}
