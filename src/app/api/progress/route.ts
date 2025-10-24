import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import type { UserProgress } from '@/lib/db';

// GET /api/progress?questionId=123 - Get progress for a specific question
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const questionId = req.nextUrl.searchParams.get('questionId');

    if (!questionId) {
      return NextResponse.json({ error: 'Question ID is required' }, { status: 400 });
    }

    // Verify user owns the subject that this question belongs to
    const ownership = await db.get<{ user_id: number }>(
      `SELECT s.user_id
       FROM questions q
       JOIN topics t ON q.topic_id = t.id
       JOIN paper_types pt ON t.paper_type_id = pt.id
       JOIN subjects s ON pt.subject_id = s.id
       WHERE q.id = ?`,
      [questionId]
    );

    if (!ownership || ownership.user_id.toString() !== user.id) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const progress = await db.get<UserProgress>(
      'SELECT * FROM user_progress WHERE user_id = ? AND question_id = ?',
      [user.id, questionId]
    );

    if (!progress) {
      return NextResponse.json({ score: 0, attempts: 0 });
    }

    return NextResponse.json(progress);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/progress - Update progress for a question
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { questionId, score, attempts } = await req.json();

    if (questionId === undefined || score === undefined) {
      return NextResponse.json({ error: 'Question ID and score are required' }, { status: 400 });
    }

    // Verify user owns the subject that this question belongs to
    const ownership = await db.get<{ user_id: number }>(
      `SELECT s.user_id
       FROM questions q
       JOIN topics t ON q.topic_id = t.id
       JOIN paper_types pt ON t.paper_type_id = pt.id
       JOIN subjects s ON pt.subject_id = s.id
       WHERE q.id = ?`,
      [questionId]
    );

    if (!ownership || ownership.user_id.toString() !== user.id) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Check if progress already exists
    const existing = await db.get<UserProgress>(
      'SELECT * FROM user_progress WHERE user_id = ? AND question_id = ?',
      [user.id, questionId]
    );

    if (existing) {
      // Update existing progress
      await db.run(
        'UPDATE user_progress SET score = ?, attempts = ?, updated_at = unixepoch() WHERE user_id = ? AND question_id = ?',
        [score, attempts !== undefined ? attempts : existing.attempts + 1, user.id, questionId]
      );
    } else {
      // Insert new progress
      await db.run(
        'INSERT INTO user_progress (user_id, question_id, score, attempts) VALUES (?, ?, ?, ?)',
        [user.id, questionId, score, attempts !== undefined ? attempts : 1]
      );
    }

    const progress = await db.get<UserProgress>(
      'SELECT * FROM user_progress WHERE user_id = ? AND question_id = ?',
      [user.id, questionId]
    );

    return NextResponse.json(progress);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
