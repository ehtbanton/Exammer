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

// DELETE /api/classes/[id]/subjects/[subjectId] - Remove a subject from the class
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; subjectId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id, subjectId } = await params;
    const classId = parseInt(id);
    const targetSubjectId = parseInt(subjectId);

    if (isNaN(classId) || isNaN(targetSubjectId)) {
      return NextResponse.json({ error: 'Invalid class ID or subject ID' }, { status: 400 });
    }

    // Check if user is a teacher of this class
    const isTeacher = await isClassTeacher(classId, user.id);

    if (!isTeacher) {
      return NextResponse.json(
        { error: 'Only teachers can remove subjects from the class' },
        { status: 403 }
      );
    }

    // Check if the assignment exists
    const assignment = await db.get(
      'SELECT id FROM class_subjects WHERE class_id = ? AND subject_id = ?',
      [classId, targetSubjectId]
    );

    if (!assignment) {
      return NextResponse.json(
        { error: 'Subject is not assigned to this class' },
        { status: 404 }
      );
    }

    // Remove the subject from the class
    await db.run(
      'DELETE FROM class_subjects WHERE class_id = ? AND subject_id = ?',
      [classId, targetSubjectId]
    );

    return NextResponse.json({
      message: 'Subject removed from class successfully'
    });
  } catch (error: any) {
    console.error('Error removing subject from class:', error);
    return NextResponse.json({ error: error.message || 'Failed to remove subject' }, { status: 500 });
  }
}
