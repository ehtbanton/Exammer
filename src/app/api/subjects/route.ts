import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import type { Subject, PastPaper, PaperType } from '@/lib/db';

export const dynamic = 'force-dynamic'; // Prevent caching to always get fresh data

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

    // If no subjects, return empty array early
    if (subjects.length === 0) {
      return NextResponse.json([]);
    }

    const subjectIds = subjects.map(s => s.id);
    const placeholders = subjectIds.map(() => '?').join(',');

    // Fetch all past papers for all subjects in one query
    const allPastPapers = await db.all<PastPaper>(
      `SELECT * FROM past_papers WHERE subject_id IN (${placeholders})`,
      subjectIds
    );

    // Fetch complete question hierarchy with user progress in ONE efficient query
    const allData = await db.all<any>(
      `SELECT
        pt.subject_id,
        pt.id as paper_type_id,
        pt.name as paper_type_name,
        t.id as topic_id,
        t.name as topic_name,
        t.description as topic_description,
        q.id as question_id,
        q.question_text,
        q.summary,
        q.solution_objectives,
        q.diagram_description,
        q.created_at as question_created_at,
        COALESCE(up.score, 0) as score,
        COALESCE(up.attempts, 0) as attempts,
        up.completed_objectives
      FROM paper_types pt
      LEFT JOIN topics t ON t.paper_type_id = pt.id
      LEFT JOIN questions q ON q.topic_id = t.id
      LEFT JOIN user_progress up ON up.question_id = q.id AND up.user_id = ?
      WHERE pt.subject_id IN (${placeholders})
      ORDER BY pt.subject_id, pt.id, t.id, q.created_at ASC`,
      [user.id, ...subjectIds]
    );

    // Transform flat result set into nested structure
    const subjectsWithDetails = subjects.map(subject => {
      const pastPapers = allPastPapers.filter(pp => pp.subject_id === subject.id);

      // Group data by paper type, then topic, then question
      const paperTypesMap = new Map<number, any>();

      allData
        .filter(row => row.subject_id === subject.id)
        .forEach(row => {
          // Skip rows without paper types (shouldn't happen, but defensive)
          if (!row.paper_type_id) return;

          // Get or create paper type
          if (!paperTypesMap.has(row.paper_type_id)) {
            paperTypesMap.set(row.paper_type_id, {
              id: row.paper_type_id,
              name: row.paper_type_name,
              topicsMap: new Map<number, any>(),
            });
          }
          const paperType = paperTypesMap.get(row.paper_type_id)!;

          // Skip if no topic (paper type exists but has no topics yet)
          if (!row.topic_id) return;

          // Get or create topic
          if (!paperType.topicsMap.has(row.topic_id)) {
            paperType.topicsMap.set(row.topic_id, {
              id: row.topic_id,
              name: row.topic_name,
              description: row.topic_description,
              examQuestions: [],
            });
          }
          const topic = paperType.topicsMap.get(row.topic_id)!;

          // Add question if it exists
          if (row.question_id) {
            // Parse solution_objectives from JSON string to array
            let solutionObjectives: string[] | undefined = undefined;
            if (row.solution_objectives) {
              try {
                solutionObjectives = JSON.parse(row.solution_objectives);
              } catch (e) {
                console.error(`Failed to parse solution_objectives for question ${row.question_id}:`, e);
              }
            }

            // Parse completed_objectives from JSON string to array
            let completedObjectives: number[] = [];
            if (row.completed_objectives) {
              try {
                completedObjectives = JSON.parse(row.completed_objectives);
              } catch (e) {
                console.error(`Failed to parse completed_objectives for question ${row.question_id}:`, e);
              }
            }

            topic.examQuestions.push({
              id: row.question_id,
              question_text: row.question_text,
              summary: row.summary,
              solutionObjectives,
              completedObjectives,
              score: row.score,
              attempts: row.attempts,
              diagram_description: row.diagram_description,
            });
          }
        });

      // Convert maps to arrays
      const paperTypes = Array.from(paperTypesMap.values()).map(pt => ({
        id: pt.id,
        name: pt.name,
        topics: Array.from(pt.topicsMap.values()),
      }));

      return {
        ...subject,
        pastPapers,
        paperTypes,
      };
    });

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
