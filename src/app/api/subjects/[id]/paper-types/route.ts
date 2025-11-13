import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import type { Subject, PaperType } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/subjects/[id]/paper-types - Get paper types with aggregated metrics
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id: subjectIdStr } = await params;
    const subjectId = parseInt(subjectIdStr);

    if (isNaN(subjectId)) {
      return NextResponse.json({ error: 'Invalid subject ID' }, { status: 400 });
    }

    // Verify user has access to this subject
    const fullUser = await db.get<{ access_level: number }>(
      'SELECT access_level FROM users WHERE id = ?',
      [user.id]
    );
    const accessLevel = fullUser?.access_level || 0;

    let hasAccess = false;

    if (accessLevel === 1) {
      // Students: check if subject is in an approved class
      const classAccess = await db.get<any>(
        `SELECT 1 FROM subjects s
         INNER JOIN class_subjects cs ON s.id = cs.subject_id
         INNER JOIN class_memberships cm ON cs.class_id = cm.class_id
         WHERE s.id = ? AND cm.user_id = ? AND cm.status = 'approved' AND cm.role = 'student'`,
        [subjectId, user.id]
      );
      hasAccess = !!classAccess;
    } else {
      // Teachers: check workspace or class membership
      const workspaceAccess = await db.get<any>(
        'SELECT 1 FROM user_workspaces WHERE user_id = ? AND subject_id = ?',
        [user.id, subjectId]
      );
      const classAccess = await db.get<any>(
        `SELECT 1 FROM subjects s
         INNER JOIN class_subjects cs ON s.id = cs.subject_id
         INNER JOIN class_memberships cm ON cs.class_id = cm.class_id
         WHERE s.id = ? AND cm.user_id = ? AND cm.status = 'approved'`,
        [subjectId, user.id]
      );
      hasAccess = !!(workspaceAccess || classAccess);
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get paper types with aggregated metrics
    // For each paper type, we need:
    // 1. Total questions across all topics
    // 2. Number of attempted questions
    // 3. Average score (calculated from topic averages of attempted questions)
    const paperTypes = await db.all<any>(
      `SELECT
        pt.id,
        pt.name,
        pt.subject_id,
        (
          SELECT COUNT(*)
          FROM questions q
          INNER JOIN topics t ON q.topic_id = t.id
          WHERE t.paper_type_id = pt.id
        ) as total_questions,
        (
          SELECT COUNT(DISTINCT q.id)
          FROM questions q
          INNER JOIN topics t ON q.topic_id = t.id
          LEFT JOIN user_progress up ON up.question_id = q.id AND up.user_id = ?
          WHERE t.paper_type_id = pt.id AND COALESCE(up.attempts, 0) > 0
        ) as attempted_questions,
        (
          SELECT AVG(topic_avg)
          FROM (
            SELECT AVG(COALESCE(up.score, 0)) as topic_avg
            FROM topics t
            LEFT JOIN questions q ON q.topic_id = t.id
            LEFT JOIN user_progress up ON up.question_id = q.id AND up.user_id = ?
            WHERE t.paper_type_id = pt.id AND COALESCE(up.attempts, 0) > 0
            GROUP BY t.id
            HAVING COUNT(CASE WHEN COALESCE(up.attempts, 0) > 0 THEN 1 END) > 0
          )
        ) as avg_score
       FROM paper_types pt
       WHERE pt.subject_id = ?
       ORDER BY pt.id`,
      [user.id, user.id, subjectId]
    );

    return NextResponse.json(paperTypes);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching paper types:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/subjects/[id]/paper-types - Add a paper type to a subject (creators only)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id: subjectId } = await params;
    const { name } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Verify user is the creator
    const workspace = await db.get<{ is_creator: number }>(
      'SELECT is_creator FROM user_workspaces WHERE user_id = ? AND subject_id = ?',
      [user.id, subjectId]
    );

    if (!workspace || workspace.is_creator !== 1) {
      return NextResponse.json({ error: 'Only creators can add paper types' }, { status: 403 });
    }

    const result = await db.run(
      'INSERT INTO paper_types (subject_id, name) VALUES (?, ?)',
      [subjectId, name]
    );

    const paperType = await db.get<PaperType>('SELECT * FROM paper_types WHERE id = ?', [result.lastID]);

    return NextResponse.json(paperType, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating paper type:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
