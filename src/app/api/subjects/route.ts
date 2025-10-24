import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import type { Subject, PastPaper, PaperType } from '@/lib/db';

// GET /api/subjects - Get all subjects for the authenticated user
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();

    const subjects = await db.all<Subject>(
      'SELECT * FROM subjects WHERE user_id = ? ORDER BY created_at DESC',
      [user.id]
    );

    // For each subject, fetch its past papers, paper types, topics, questions, and user progress
    const subjectsWithDetails = await Promise.all(
      subjects.map(async (subject) => {
        const pastPapers = await db.all<PastPaper>(
          'SELECT * FROM past_papers WHERE subject_id = ?',
          [subject.id]
        );

        const paperTypes = await db.all<PaperType>(
          'SELECT * FROM paper_types WHERE subject_id = ?',
          [subject.id]
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

        return {
          ...subject,
          pastPapers,
          paperTypes: paperTypesWithTopics,
        };
      })
    );

    return NextResponse.json(subjectsWithDetails);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching subjects:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/subjects - Create a new subject
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { name, syllabusContent } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Subject name is required' }, { status: 400 });
    }

    const result = await db.run(
      'INSERT INTO subjects (user_id, name, syllabus_content) VALUES (?, ?, ?)',
      [user.id, name, syllabusContent || null]
    );

    const subject = await db.get<Subject>('SELECT * FROM subjects WHERE id = ?', [result.lastID]);

    return NextResponse.json(subject, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating subject:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
