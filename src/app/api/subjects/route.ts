import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import type { Subject, PastPaper, PaperType } from '@/lib/db';

// GET /api/subjects - Get subjects in user's workspace (includes query param for filtering)
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter'); // 'workspace', 'created', 'other', or null (all workspace)
    const search = searchParams.get('search'); // optional search query

    let subjects: Subject[];

    if (filter === 'other') {
      // Get subjects NOT in user's workspace, with optional search
      if (search && search.trim()) {
        subjects = await db.all<Subject>(
          `SELECT s.*, 0 as is_creator FROM subjects s
           WHERE s.id NOT IN (
             SELECT subject_id FROM user_workspaces WHERE user_id = ?
           )
           AND s.name LIKE ?
           ORDER BY s.created_at DESC`,
          [user.id, `%${search.trim()}%`]
        );
      } else {
        subjects = await db.all<Subject>(
          `SELECT s.*, 0 as is_creator FROM subjects s
           WHERE s.id NOT IN (
             SELECT subject_id FROM user_workspaces WHERE user_id = ?
           )
           ORDER BY s.created_at DESC`,
          [user.id]
        );
      }
    } else if (filter === 'created') {
      // Get subjects created by user
      subjects = await db.all<Subject>(
        `SELECT s.*, uw.is_creator FROM subjects s
         INNER JOIN user_workspaces uw ON s.id = uw.subject_id
         WHERE uw.user_id = ? AND uw.is_creator = 1
         ORDER BY s.created_at DESC`,
        [user.id]
      );
    } else {
      // Default: Get all subjects in user's workspace
      subjects = await db.all<Subject>(
        `SELECT s.*, uw.is_creator FROM subjects s
         INNER JOIN user_workspaces uw ON s.id = uw.subject_id
         WHERE uw.user_id = ?
         ORDER BY s.created_at DESC`,
        [user.id]
      );
    }

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

// POST /api/subjects - Create a new subject and add to user's workspace
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { name, syllabusContent } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Subject name is required' }, { status: 400 });
    }

    // Create the subject
    const result = await db.run(
      'INSERT INTO subjects (name, syllabus_content) VALUES (?, ?)',
      [name, syllabusContent || null]
    );

    const subjectId = result.lastID;

    // Add to user's workspace as creator
    await db.run(
      'INSERT INTO user_workspaces (user_id, subject_id, is_creator) VALUES (?, ?, 1)',
      [user.id, subjectId]
    );

    const subject = await db.get<Subject>('SELECT * FROM subjects WHERE id = ?', [subjectId]);

    return NextResponse.json(subject, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating subject:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
