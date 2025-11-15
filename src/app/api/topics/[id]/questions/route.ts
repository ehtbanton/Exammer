import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import type { Question, UserProgress } from '@/lib/db';

// GET /api/topics/[id]/questions - Get question previews for a topic (no full content)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id: topicIdStr } = await params;
    const topicId = parseInt(topicIdStr);

    if (isNaN(topicId)) {
      return NextResponse.json({ error: 'Invalid topic ID' }, { status: 400 });
    }

    // Get subject_id for this topic
    const topicInfo = await db.get<{ subject_id: number }>(
      `SELECT s.id as subject_id
       FROM topics t
       JOIN paper_types pt ON t.paper_type_id = pt.id
       JOIN subjects s ON pt.subject_id = s.id
       WHERE t.id = ?`,
      [topicId]
    );

    if (!topicInfo) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
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
        [topicInfo.subject_id, user.id]
      );
      hasAccess = !!classAccess;
    } else {
      // Teachers: check workspace or class membership
      const workspaceAccess = await db.get<any>(
        'SELECT 1 FROM user_workspaces WHERE user_id = ? AND subject_id = ?',
        [user.id, topicInfo.subject_id]
      );
      const classAccess = await db.get<any>(
        `SELECT 1 FROM subjects s
         INNER JOIN class_subjects cs ON s.id = cs.subject_id
         INNER JOIN class_memberships cm ON cs.class_id = cm.class_id
         WHERE s.id = ? AND cm.user_id = ? AND cm.status = 'approved'`,
        [topicInfo.subject_id, user.id]
      );
      hasAccess = !!(workspaceAccess || classAccess);
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get question previews with user progress
    // Only return: id, summary, score, attempts, has_markscheme
    // Do NOT return: question_text, solution_objectives, diagram_geogebra, diagram_bounds
    const questions = await db.all<any>(
      `SELECT
        q.id,
        q.summary,
        q.topic_id,
        CASE WHEN q.solution_objectives IS NOT NULL AND q.solution_objectives != '' THEN 1 ELSE 0 END as has_markscheme,
        COALESCE(up.score, 0) as score,
        COALESCE(up.attempts, 0) as attempts
       FROM questions q
       LEFT JOIN user_progress up ON up.question_id = q.id AND up.user_id = ?
       WHERE q.topic_id = ?
       ORDER BY q.created_at ASC`,
      [user.id, topicId]
    );

    return NextResponse.json(questions);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching questions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/topics/[id]/questions - Add a question to a topic (creators only)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id: topicId } = await params;
    const { questionText, summary } = await req.json();

    if (!questionText || !summary) {
      return NextResponse.json({ error: 'Question text and summary are required' }, { status: 400 });
    }

    // Get subject_id for this topic
    const topicInfo = await db.get<{ subject_id: number }>(
      `SELECT s.id as subject_id
       FROM topics t
       JOIN paper_types pt ON t.paper_type_id = pt.id
       JOIN subjects s ON pt.subject_id = s.id
       WHERE t.id = ?`,
      [topicId]
    );

    if (!topicInfo) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    // Verify user is the creator
    const workspace = await db.get<{ is_creator: number }>(
      'SELECT is_creator FROM user_workspaces WHERE user_id = ? AND subject_id = ?',
      [user.id, topicInfo.subject_id]
    );

    if (!workspace || workspace.is_creator !== 1) {
      return NextResponse.json({ error: 'Only creators can add questions' }, { status: 403 });
    }

    const result = await db.run(
      'INSERT INTO questions (topic_id, question_text, summary) VALUES (?, ?, ?)',
      [topicId, questionText, summary]
    );

    const question = await db.get<Question>('SELECT * FROM questions WHERE id = ?', [result.lastID]);

    return NextResponse.json(question, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating question:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
