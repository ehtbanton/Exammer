import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import type { UserProgress } from '@/lib/db';

// GET /api/questions/[id]/progress - Get user progress for a question (workspace members)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const questionId = params.id;

    // Get subject_id for this question
    const questionInfo = await db.get<{ subject_id: number }>(
      `SELECT s.id as subject_id
       FROM questions q
       JOIN topics t ON q.topic_id = t.id
       JOIN paper_types pt ON t.paper_type_id = pt.id
       JOIN subjects s ON pt.subject_id = s.id
       WHERE q.id = ?`,
      [questionId]
    );

    if (!questionInfo) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Verify subject is in user's workspace
    const inWorkspace = await db.get(
      'SELECT id FROM user_workspaces WHERE user_id = ? AND subject_id = ?',
      [user.id, questionInfo.subject_id]
    );

    if (!inWorkspace) {
      return NextResponse.json({ error: 'Question not found in workspace' }, { status: 404 });
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

// POST /api/questions/[id]/progress - Update user progress for a question (workspace members)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const questionId = params.id;
    const { score } = await req.json();

    if (typeof score !== 'number' || score < 0 || score > 10) {
      return NextResponse.json({ error: 'Score must be a number between 0 and 10' }, { status: 400 });
    }

    // Get subject_id for this question
    const questionInfo = await db.get<{ subject_id: number }>(
      `SELECT s.id as subject_id
       FROM questions q
       JOIN topics t ON q.topic_id = t.id
       JOIN paper_types pt ON t.paper_type_id = pt.id
       JOIN subjects s ON pt.subject_id = s.id
       WHERE q.id = ?`,
      [questionId]
    );

    if (!questionInfo) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Verify subject is in user's workspace
    const inWorkspace = await db.get(
      'SELECT id FROM user_workspaces WHERE user_id = ? AND subject_id = ?',
      [user.id, questionInfo.subject_id]
    );

    if (!inWorkspace) {
      return NextResponse.json({ error: 'Question not found in workspace' }, { status: 404 });
    }

    // Get current progress
    const currentProgress = await db.get<UserProgress>(
      'SELECT * FROM user_progress WHERE user_id = ? AND question_id = ?',
      [user.id, questionId]
    );

    let newScore: number;
    let newAttempts: number;

    if (!currentProgress) {
      // First attempt - use the score formula
      // Formula: new_percentage = (old_percentage * (n + 1) + score * 10) / (n + 2)
      // For first attempt: (0 * 1 + score * 10) / 2
      newScore = (score * 10) / 2;
      newAttempts = 1;

      await db.run(
        'INSERT INTO user_progress (user_id, question_id, score, attempts, updated_at) VALUES (?, ?, ?, ?, unixepoch())',
        [user.id, questionId, newScore, newAttempts]
      );
    } else {
      // Subsequent attempts
      const n = currentProgress.attempts;
      const oldPercentage = currentProgress.score;
      newScore = (oldPercentage * (n + 1) + score * 10) / (n + 2);
      newAttempts = n + 1;

      await db.run(
        'UPDATE user_progress SET score = ?, attempts = ?, updated_at = unixepoch() WHERE user_id = ? AND question_id = ?',
        [newScore, newAttempts, user.id, questionId]
      );
    }

    const updatedProgress = await db.get<UserProgress>(
      'SELECT * FROM user_progress WHERE user_id = ? AND question_id = ?',
      [user.id, questionId]
    );

    return NextResponse.json(updatedProgress);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
