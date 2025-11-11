import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/subjects/list - Get minimal subject list for workspace page
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();

    // Get user's access level
    const fullUser = await db.get<{ access_level: number }>(
      'SELECT access_level FROM users WHERE id = ?',
      [user.id]
    );

    const accessLevel = fullUser?.access_level || 0;

    // Level 1 users (students) can only access subjects from their approved classes
    if (accessLevel === 1) {
      const subjects = await db.all<any>(
        `SELECT DISTINCT
          s.id,
          s.name,
          0 as is_creator,
          (SELECT COUNT(*) FROM paper_types WHERE subject_id = s.id) as paper_types_count
         FROM subjects s
         INNER JOIN class_subjects cs ON s.id = cs.subject_id
         INNER JOIN class_memberships cm ON cs.class_id = cm.class_id
         WHERE cm.user_id = ? AND cm.status = 'approved' AND cm.role = 'student'
         ORDER BY s.created_at DESC`,
        [user.id]
      );

      return NextResponse.json(subjects);
    }

    // Level 2+ users (teachers and admins) - get workspace subjects + class subjects
    const workspaceSubjects = await db.all<any>(
      `SELECT
        s.id,
        s.name,
        uw.is_creator,
        (SELECT COUNT(*) FROM paper_types WHERE subject_id = s.id) as paper_types_count
       FROM subjects s
       INNER JOIN user_workspaces uw ON s.id = uw.subject_id
       WHERE uw.user_id = ?
       ORDER BY s.created_at DESC`,
      [user.id]
    );

    const classSubjects = await db.all<any>(
      `SELECT DISTINCT
        s.id,
        s.name,
        0 as is_creator,
        (SELECT COUNT(*) FROM paper_types WHERE subject_id = s.id) as paper_types_count
       FROM subjects s
       INNER JOIN class_subjects cs ON s.id = cs.subject_id
       INNER JOIN class_memberships cm ON cs.class_id = cm.class_id
       WHERE cm.user_id = ? AND cm.status = 'approved'
       AND s.id NOT IN (
         SELECT subject_id FROM user_workspaces WHERE user_id = ?
       )
       ORDER BY s.created_at DESC`,
      [user.id, user.id]
    );

    // Merge workspace and class subjects
    const subjects = [...workspaceSubjects, ...classSubjects];

    return NextResponse.json(subjects);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching subjects list:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
