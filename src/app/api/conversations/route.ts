import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// POST /api/conversations - Create a new conversation
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { questionId } = await req.json();

    if (!questionId) {
      return NextResponse.json({ error: 'Question ID is required' }, { status: 400 });
    }

    // Verify question exists
    const question = await db.get<{ id: number }>(
      'SELECT id FROM questions WHERE id = ?',
      [questionId]
    );

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Create conversation record
    const result = await db.run(
      `INSERT INTO conversations (user_id, question_id, started_at)
       VALUES (?, ?, unixepoch())`,
      [user.id, questionId]
    );

    return NextResponse.json({
      id: result.lastID,
      questionId,
      startedAt: Math.floor(Date.now() / 1000),
    });
  } catch (error: any) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create conversation' },
      { status: 500 }
    );
  }
}

// GET /api/conversations - Get user's conversations (with optional filters)
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const questionId = searchParams.get('questionId');

    let query = `
      SELECT
        c.id,
        c.question_id,
        c.started_at,
        c.ended_at,
        c.final_score,
        c.summary,
        q.summary as question_summary,
        t.name as topic_name,
        s.name as subject_name
      FROM conversations c
      JOIN questions q ON c.question_id = q.id
      JOIN topics t ON q.topic_id = t.id
      JOIN paper_types pt ON t.paper_type_id = pt.id
      JOIN subjects s ON pt.subject_id = s.id
      WHERE c.user_id = ?
    `;
    const params: any[] = [user.id];

    if (questionId) {
      query += ' AND c.question_id = ?';
      params.push(parseInt(questionId));
    }

    query += ' ORDER BY c.started_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const conversations = await db.all(query, params);

    return NextResponse.json({ conversations });
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}
