import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import type { Question, UserProgress } from '@/lib/db';

// GET /api/topics/[id]/questions - Get all questions for a topic with user progress (workspace members)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id: topicId } = await params;

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

    // Verify subject is in user's workspace
    const inWorkspace = await db.get(
      'SELECT id FROM user_workspaces WHERE user_id = ? AND subject_id = ?',
      [user.id, topicInfo.subject_id]
    );

    if (!inWorkspace) {
      return NextResponse.json({ error: 'Topic not found in workspace' }, { status: 404 });
    }

    const questions = await db.all<Question>(
      'SELECT * FROM questions WHERE topic_id = ? ORDER BY created_at ASC',
      [topicId]
    );

    // For each question, fetch user progress and parse JSON fields
    const questionsWithProgress = await Promise.all(
      questions.map(async (question) => {
        const progress = await db.get<UserProgress>(
          'SELECT * FROM user_progress WHERE user_id = ? AND question_id = ?',
          [user.id, question.id]
        );

        // Parse solution_objectives from JSON string to array
        let solutionObjectives: string[] | undefined = undefined;
        if (question.solution_objectives) {
          try {
            solutionObjectives = JSON.parse(question.solution_objectives);
          } catch (e) {
            console.error(`Failed to parse solution_objectives for question ${question.id}:`, e);
          }
        }

        // Parse completed_objectives from JSON string to array
        let completedObjectives: number[] = [];
        if (progress?.completed_objectives) {
          try {
            completedObjectives = JSON.parse(progress.completed_objectives);
          } catch (e) {
            console.error(`Failed to parse completed_objectives for question ${question.id}:`, e);
          }
        }

        return {
          ...question,
          solutionObjectives,
          score: progress?.score || 0,
          attempts: progress?.attempts || 0,
          completedObjectives,
        };
      })
    );

    return NextResponse.json(questionsWithProgress);
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
