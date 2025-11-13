import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import type { Topic } from '@/lib/db';

// GET /api/paper-types/[id]/topics - Get all topics for a paper type with aggregated metrics
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id: paperTypeIdStr } = await params;
    const paperTypeId = parseInt(paperTypeIdStr);

    if (isNaN(paperTypeId)) {
      return NextResponse.json({ error: 'Invalid paper type ID' }, { status: 400 });
    }

    // Get subject_id and verify access
    const paperType = await db.get<{ subject_id: number }>(
      'SELECT subject_id FROM paper_types WHERE id = ?',
      [paperTypeId]
    );

    if (!paperType) {
      return NextResponse.json({ error: 'Paper type not found' }, { status: 404 });
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
        [paperType.subject_id, user.id]
      );
      hasAccess = !!classAccess;
    } else {
      // Teachers: check workspace or class membership
      const workspaceAccess = await db.get<any>(
        'SELECT 1 FROM user_workspaces WHERE user_id = ? AND subject_id = ?',
        [user.id, paperType.subject_id]
      );
      const classAccess = await db.get<any>(
        `SELECT 1 FROM subjects s
         INNER JOIN class_subjects cs ON s.id = cs.subject_id
         INNER JOIN class_memberships cm ON cs.class_id = cm.class_id
         WHERE s.id = ? AND cm.user_id = ? AND cm.status = 'approved'`,
        [paperType.subject_id, user.id]
      );
      hasAccess = !!(workspaceAccess || classAccess);
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get topics with aggregated metrics
    const topics = await db.all<any>(
      `SELECT
        t.id,
        t.name,
        t.description,
        t.paper_type_id,
        (
          SELECT COUNT(*)
          FROM questions q
          WHERE q.topic_id = t.id
        ) as total_questions,
        (
          SELECT COUNT(*)
          FROM questions q
          LEFT JOIN user_progress up ON up.question_id = q.id AND up.user_id = ?
          WHERE q.topic_id = t.id AND COALESCE(up.attempts, 0) > 0
        ) as attempted_questions,
        (
          SELECT AVG(COALESCE(up.score, 0))
          FROM questions q
          LEFT JOIN user_progress up ON up.question_id = q.id AND up.user_id = ?
          WHERE q.topic_id = t.id AND COALESCE(up.attempts, 0) > 0
        ) as avg_score
       FROM topics t
       WHERE t.paper_type_id = ?
       ORDER BY t.id`,
      [user.id, user.id, paperTypeId]
    );

    return NextResponse.json(topics);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching topics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/paper-types/[id]/topics - Add a topic to a paper type (creators only)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id: paperTypeId } = await params;
    const { name, description } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Get subject_id for this paper type
    const paperType = await db.get<{ subject_id: number }>(
      'SELECT subject_id FROM paper_types WHERE id = ?',
      [paperTypeId]
    );

    if (!paperType) {
      return NextResponse.json({ error: 'Paper type not found' }, { status: 404 });
    }

    // Verify user is the creator
    const workspace = await db.get<{ is_creator: number }>(
      'SELECT is_creator FROM user_workspaces WHERE user_id = ? AND subject_id = ?',
      [user.id, paperType.subject_id]
    );

    if (!workspace || workspace.is_creator !== 1) {
      return NextResponse.json({ error: 'Only creators can add topics' }, { status: 403 });
    }

    const result = await db.run(
      'INSERT INTO topics (paper_type_id, name, description) VALUES (?, ?, ?)',
      [paperTypeId, name, description || null]
    );

    const topic = await db.get<Topic>('SELECT * FROM topics WHERE id = ?', [result.lastID]);

    return NextResponse.json(topic, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating topic:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
