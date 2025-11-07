import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import type { UserProgress } from '@/lib/db';

// GET /api/questions/[id]/progress - Get user progress for a question (workspace members)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id: questionId } = await params;

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

    // Verify user has access to the subject (via workspace or class membership)
    const hasAccess = await db.get(
      `SELECT 1 FROM user_workspaces
       WHERE user_id = ? AND subject_id = ?
       UNION
       SELECT 1 FROM class_subjects cs
       JOIN class_memberships cm ON cs.class_id = cm.class_id
       WHERE cm.user_id = ? AND cs.subject_id = ? AND cm.status = 'approved'`,
      [user.id, questionInfo.subject_id, user.id, questionInfo.subject_id]
    );

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const progress = await db.get<UserProgress>(
      'SELECT * FROM user_progress WHERE user_id = ? AND question_id = ?',
      [user.id, questionId]
    );

    if (!progress) {
      // No progress yet, return 50% as starting score
      return NextResponse.json({ score: 50, attempts: 0 });
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
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id: questionId } = await params;
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

    // Verify user has access to the subject (via workspace or class membership)
    const hasAccess = await db.get(
      `SELECT 1 FROM user_workspaces
       WHERE user_id = ? AND subject_id = ?
       UNION
       SELECT 1 FROM class_subjects cs
       JOIN class_memberships cm ON cs.class_id = cm.class_id
       WHERE cm.user_id = ? AND cs.subject_id = ? AND cm.status = 'approved'`,
      [user.id, questionInfo.subject_id, user.id, questionInfo.subject_id]
    );

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get current progress
    const currentProgress = await db.get<UserProgress>(
      'SELECT * FROM user_progress WHERE user_id = ? AND question_id = ?',
      [user.id, questionId]
    );

    let newScore: number;
    let newAttempts: number;
    let scoreHistory: number[];

    if (!currentProgress) {
      // First attempt - start with imaginary 50% score, then average with actual score
      // Starting score: 50% (5 out of 10)
      // New score: average of [5, actual_score]
      scoreHistory = [5, score]; // Store last 3 scores (out of 10)
      newScore = (scoreHistory.reduce((a, b) => a + b, 0) / scoreHistory.length) * 10; // Convert to percentage
      newAttempts = 1;

      await db.run(
        'INSERT INTO user_progress (user_id, question_id, score, attempts, score_history, updated_at) VALUES (?, ?, ?, ?, ?, unixepoch())',
        [user.id, questionId, newScore, newAttempts, JSON.stringify(scoreHistory)]
      );
    } else {
      // Subsequent attempts - keep only last 3 scores
      scoreHistory = currentProgress.score_history
        ? JSON.parse(currentProgress.score_history)
        : [5]; // Fallback for old records

      // Add new score and keep only last 3
      scoreHistory.push(score);
      if (scoreHistory.length > 3) {
        scoreHistory = scoreHistory.slice(-3); // Keep only last 3
      }

      // Calculate average of last 3 scores
      newScore = (scoreHistory.reduce((a, b) => a + b, 0) / scoreHistory.length) * 10; // Convert to percentage
      newAttempts = currentProgress.attempts + 1;

      await db.run(
        'UPDATE user_progress SET score = ?, attempts = ?, score_history = ?, updated_at = unixepoch() WHERE user_id = ? AND question_id = ?',
        [newScore, newAttempts, JSON.stringify(scoreHistory), user.id, questionId]
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
