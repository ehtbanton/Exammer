import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import type { Question } from '@/lib/db';

// GET /api/topics/[id]/questions - Get all questions for a topic
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const topicId = params.id;

    // Verify user owns the subject that this topic belongs to (through paper_type)
    const ownership = await db.get<{ user_id: number }>(
      `SELECT s.user_id
       FROM topics t
       JOIN paper_types pt ON t.paper_type_id = pt.id
       JOIN subjects s ON pt.subject_id = s.id
       WHERE t.id = ?`,
      [topicId]
    );

    if (!ownership || ownership.user_id.toString() !== user.id) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    const questions = await db.all<Question>(
      'SELECT * FROM questions WHERE topic_id = ?',
      [topicId]
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

// POST /api/topics/[id]/questions - Add a question to a topic
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const topicId = params.id;
    const { questionText, summary } = await req.json();

    if (!questionText || !summary) {
      return NextResponse.json({ error: 'Question text and summary are required' }, { status: 400 });
    }

    // Verify user owns the subject that this topic belongs to (through paper_type)
    const ownership = await db.get<{ user_id: number }>(
      `SELECT s.user_id
       FROM topics t
       JOIN paper_types pt ON t.paper_type_id = pt.id
       JOIN subjects s ON pt.subject_id = s.id
       WHERE t.id = ?`,
      [topicId]
    );

    if (!ownership || ownership.user_id.toString() !== user.id) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
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
