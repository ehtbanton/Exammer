import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import type { Subject, PastPaper, PaperType } from '@/lib/db';

// GET /api/subjects/[id] - Get a specific subject
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const subjectId = params.id;

    const subject = await db.get<Subject>(
      'SELECT * FROM subjects WHERE id = ? AND user_id = ?',
      [subjectId, user.id]
    );

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    const pastPapers = await db.all<PastPaper>(
      'SELECT * FROM past_papers WHERE subject_id = ?',
      [subjectId]
    );

    const paperTypes = await db.all<PaperType>(
      'SELECT * FROM paper_types WHERE subject_id = ?',
      [subjectId]
    );

    // For each paper type, fetch topics with questions and user progress
    const paperTypesWithTopics = await Promise.all(
      paperTypes.map(async (pt) => {
        const topics = await db.all<any>(
          'SELECT * FROM topics WHERE paper_type_id = ?',
          [pt.id]
        );

        const topicsWithQuestions = await Promise.all(
          topics.map(async (topic) => {
            const questions = await db.all<any>(
              'SELECT * FROM questions WHERE topic_id = ? ORDER BY created_at ASC',
              [topic.id]
            );

            // Fetch user progress for each question
            const questionsWithProgress = await Promise.all(
              questions.map(async (question) => {
                const progress = await db.get<any>(
                  'SELECT score, attempts FROM user_progress WHERE user_id = ? AND question_id = ?',
                  [user.id, question.id]
                );

                return {
                  id: question.id,
                  question_text: question.question_text,
                  summary: question.summary,
                  score: progress?.score || 0,
                  attempts: progress?.attempts || 0,
                };
              })
            );

            return {
              id: topic.id,
              name: topic.name,
              description: topic.description,
              examQuestions: questionsWithProgress,
            };
          })
        );

        return {
          id: pt.id,
          name: pt.name,
          topics: topicsWithQuestions,
        };
      })
    );

    return NextResponse.json({
      ...subject,
      pastPapers,
      paperTypes: paperTypesWithTopics,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching subject:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/subjects/[id] - Update a subject
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const subjectId = params.id;
    const { name, syllabusContent } = await req.json();

    // Verify ownership
    const subject = await db.get<Subject>(
      'SELECT * FROM subjects WHERE id = ? AND user_id = ?',
      [subjectId, user.id]
    );

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    await db.run(
      'UPDATE subjects SET name = ?, syllabus_content = ?, updated_at = unixepoch() WHERE id = ?',
      [name || subject.name, syllabusContent !== undefined ? syllabusContent : subject.syllabus_content, subjectId]
    );

    const updatedSubject = await db.get<Subject>('SELECT * FROM subjects WHERE id = ?', [subjectId]);

    return NextResponse.json(updatedSubject);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating subject:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/subjects/[id] - Delete a subject
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const subjectId = params.id;

    // Verify ownership
    const subject = await db.get<Subject>(
      'SELECT * FROM subjects WHERE id = ? AND user_id = ?',
      [subjectId, user.id]
    );

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    await db.run('DELETE FROM subjects WHERE id = ?', [subjectId]);

    return NextResponse.json({ message: 'Subject deleted successfully' });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error deleting subject:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
