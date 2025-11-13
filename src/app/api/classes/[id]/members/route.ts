import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

interface ClassMemberWithUser {
  id: number;
  class_id: number;
  user_id: number;
  role: 'teacher' | 'student';
  status: 'pending' | 'approved' | 'rejected';
  joined_at: number;
  user_name: string | null;
  user_email: string;
}

// Helper to check if user is a teacher of the class
async function isClassTeacher(classId: number, userId: number): Promise<boolean> {
  const membership = await db.get<{ role: string; status: string }>(
    `SELECT role, status FROM class_memberships
     WHERE class_id = ? AND user_id = ? AND role = 'teacher' AND status = 'approved'`,
    [classId, userId]
  );

  return !!membership;
}

// GET /api/classes/[id]/members - Get all members (and pending requests)
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

    // Check if user is a teacher of this class
    const isTeacher = await isClassTeacher(classId, user.id);

    if (!isTeacher) {
      return NextResponse.json(
        { error: 'Only teachers can view class members' },
        { status: 403 }
      );
    }

    // Get all members with user details
    const members = await db.all<ClassMemberWithUser>(
      `SELECT
        cm.*,
        u.name as user_name,
        u.email as user_email
      FROM class_memberships cm
      INNER JOIN users u ON cm.user_id = u.id
      WHERE cm.class_id = ?
      ORDER BY
        CASE cm.status
          WHEN 'pending' THEN 1
          WHEN 'approved' THEN 2
          WHEN 'rejected' THEN 3
        END,
        cm.role DESC,
        cm.joined_at DESC`,
      [classId]
    );

    return NextResponse.json(members);
  } catch (error: any) {
    console.error('Error fetching class members:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch members' }, { status: 500 });
  }
}
