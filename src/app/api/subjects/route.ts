import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import type { Subject, PastPaper, PaperType } from '@/lib/db';

export const dynamic = 'force-dynamic'; // Prevent caching to always get fresh data

// GET /api/subjects - DEPRECATED: Now only serves search results (filter=other)
// Use /api/subjects/list for main workspace subjects
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter');
    const search = searchParams.get('search');

    // This endpoint now ONLY serves the "other subjects" search feature
    if (filter !== 'other') {
      return NextResponse.json(
        { error: 'This endpoint only supports filter=other. Use /api/subjects/list for workspace subjects.' },
        { status: 400 }
      );
    }

    // Get user's access level
    const fullUser = await db.get<{ access_level: number }>(
      'SELECT access_level FROM users WHERE id = ?',
      [user.id]
    );

    const accessLevel = fullUser?.access_level || 0;

    // Level 1 users (students) cannot search for other subjects
    if (accessLevel === 1) {
      return NextResponse.json([]);
    }

    // Level 2+ users (teachers and admins) can search for subjects not in workspace
    let subjects: Subject[];

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
        q.diagram_mermaid,
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
              diagram_mermaid: row.diagram_mermaid,
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

    // Check user's access level - students (level 1) cannot create subjects
    const fullUser = await db.get<{ access_level: number }>(
      'SELECT access_level FROM users WHERE id = ?',
      [user.id]
    );

    if (!fullUser || fullUser.access_level < 2) {
      return NextResponse.json(
        { error: 'Students cannot create subjects. Only teachers (level 2+) can create subjects.' },
        { status: 403 }
      );
    }

    const { name, syllabusContent, classId } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Subject name is required' }, { status: 400 });
    }

    // If classId is provided, verify the user is a teacher of that class
    if (classId) {
      const isTeacher = await db.get<{ role: string; status: string }>(
        `SELECT role, status FROM class_memberships
         WHERE class_id = ? AND user_id = ? AND role = 'teacher' AND status = 'approved'`,
        [classId, user.id]
      );

      if (!isTeacher) {
        return NextResponse.json(
          { error: 'You must be a teacher of the class to create class-specific subjects' },
          { status: 403 }
        );
      }
    }

    // Create the subject
    const result = await db.run(
      'INSERT INTO subjects (name, syllabus_content, class_id) VALUES (?, ?, ?)',
      [name, syllabusContent || null, classId || null]
    );

    const subjectId = result.lastID;

    // Add to user's workspace as creator
    await db.run(
      'INSERT INTO user_workspaces (user_id, subject_id, is_creator) VALUES (?, ?, 1)',
      [user.id, subjectId]
    );

    // If classId is provided, also add to class_subjects
    if (classId) {
      await db.run(
        'INSERT INTO class_subjects (class_id, subject_id, added_by_user_id) VALUES (?, ?, ?)',
        [classId, subjectId, user.id]
      );
    }

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
