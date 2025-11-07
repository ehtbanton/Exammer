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

// GET /api/classes/[id]/subjects - Get all subjects assigned to a class
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const classId = parseInt(id);

    if (isNaN(classId)) {
      return NextResponse.json({ error: 'Invalid class ID' }, { status: 400 });
    }

    // Check if user is a member of this class (any role, approved)
    const membership = await db.get<{ status: string }>(
      `SELECT status FROM class_memberships
       WHERE class_id = ? AND user_id = ? AND status = 'approved'`,
      [classId, user.id]
    );

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied. You are not a member of this class.' },
        { status: 403 }
      );
    }

    // Get all subjects assigned to this class
    const subjects = await db.all<any>(
      `SELECT
        s.*,
        cs.added_at,
        u.name as added_by_name
      FROM class_subjects cs
      INNER JOIN subjects s ON cs.subject_id = s.id
      LEFT JOIN users u ON cs.added_by_user_id = u.id
      WHERE cs.class_id = ?
      ORDER BY cs.added_at DESC`,
      [classId]
    );

    return NextResponse.json(subjects);
  } catch (error: any) {
    console.error('Error fetching class subjects:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch subjects' }, { status: 500 });
  }
}

// POST /api/classes/[id]/subjects - Add a subject to the class
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const classId = parseInt(id);

    if (isNaN(classId)) {
      return NextResponse.json({ error: 'Invalid class ID' }, { status: 400 });
    }

    // Check if user is a teacher of this class
    const isTeacher = await isClassTeacher(classId, user.id);

    if (!isTeacher) {
      return NextResponse.json(
        { error: 'Only teachers can add subjects to the class' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { subjectId } = body;

    if (!subjectId || typeof subjectId !== 'number') {
      return NextResponse.json({ error: 'Subject ID is required' }, { status: 400 });
    }

    // Check if subject exists
    const subject = await db.get(
      'SELECT id FROM subjects WHERE id = ?',
      [subjectId]
    );

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    // Check if subject is already assigned to this class
    const existing = await db.get(
      'SELECT id FROM class_subjects WHERE class_id = ? AND subject_id = ?',
      [classId, subjectId]
    );

    if (existing) {
      return NextResponse.json(
        { error: 'Subject is already assigned to this class' },
        { status: 400 }
      );
    }

    // Add the subject to the class
    await db.run(
      `INSERT INTO class_subjects (class_id, subject_id, added_by_user_id)
       VALUES (?, ?, ?)`,
      [classId, subjectId, user.id]
    );

    return NextResponse.json({
      message: 'Subject added to class successfully'
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error adding subject to class:', error);
    return NextResponse.json({ error: error.message || 'Failed to add subject' }, { status: 500 });
  }
}
