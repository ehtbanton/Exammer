import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, getUserWithAccessLevel } from '@/lib/auth-helpers';
import type { Subject, PastPaper, PaperType } from '@/lib/db';

export const dynamic = 'force-dynamic'; // Prevent caching to always get fresh data

// GET /api/subjects/[id] - Get a specific subject (must be in user's workspace)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id: subjectId } = await params;

    // Check if subject is in user's workspace
    const workspace = await db.get(
      'SELECT id FROM user_workspaces WHERE user_id = ? AND subject_id = ?',
      [user.id, subjectId]
    );

    if (!workspace) {
      return NextResponse.json({ error: 'Subject not found in workspace' }, { status: 404 });
    }

    // Get the subject
    const subject = await db.get<Subject>(
      'SELECT * FROM subjects WHERE id = ?',
      [subjectId]
    );

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    // Fetch past papers
    const pastPapers = await db.all<PastPaper>(
      'SELECT * FROM past_papers WHERE subject_id = ?',
      [subjectId]
    );

    // Fetch complete question hierarchy with user progress in ONE efficient query
    const allData = await db.all<any>(
      `SELECT
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
        q.paper_date,
        q.question_number,
        q.created_at as question_created_at,
        COALESCE(up.score, 0) as score,
        COALESCE(up.attempts, 0) as attempts,
        up.completed_objectives
      FROM paper_types pt
      LEFT JOIN topics t ON t.paper_type_id = pt.id
      LEFT JOIN questions q ON q.topic_id = t.id
      LEFT JOIN user_progress up ON up.question_id = q.id AND up.user_id = ?
      WHERE pt.subject_id = ?
      ORDER BY pt.id, t.id, q.created_at ASC`,
      [user.id, subjectId]
    );

    // Transform flat result set into nested structure
    const paperTypesMap = new Map<number, any>();

    allData.forEach(row => {
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
          paperDate: row.paper_date,
          questionNumber: row.question_number,
          diagram_description: row.diagram_description,
        });
      }
    });

    // Convert maps to arrays
    const paperTypesWithTopics = Array.from(paperTypesMap.values()).map(pt => ({
      id: pt.id,
      name: pt.name,
      topics: Array.from(pt.topicsMap.values()),
    }));

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

// PUT /api/subjects/[id] - Update a subject (creators only)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id: subjectId } = await params;
    const { name, syllabusContent } = await req.json();

    // Verify user is the creator
    const workspace = await db.get<{ is_creator: number }>(
      'SELECT is_creator FROM user_workspaces WHERE user_id = ? AND subject_id = ?',
      [user.id, subjectId]
    );

    if (!workspace || workspace.is_creator !== 1) {
      return NextResponse.json({ error: 'Only creators can update subjects' }, { status: 403 });
    }

    const subject = await db.get<Subject>('SELECT * FROM subjects WHERE id = ?', [subjectId]);

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

// DELETE /api/subjects/[id] - Delete a subject (creators and level 3 users, removes from everyone's workspace)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id: subjectId } = await params;

    // Get user's full data including access level
    const fullUser = await getUserWithAccessLevel(user.id);

    if (!fullUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is level 3 (can delete any subject)
    const isLevel3 = fullUser.access_level >= 3;

    if (!isLevel3) {
      // If not level 3, verify user is the creator
      const workspace = await db.get<{ is_creator: number }>(
        'SELECT is_creator FROM user_workspaces WHERE user_id = ? AND subject_id = ?',
        [user.id, subjectId]
      );

      if (!workspace || workspace.is_creator !== 1) {
        return NextResponse.json({ error: 'Only creators or level 3 users can delete subjects' }, { status: 403 });
      }
    }

    // Delete the subject (CASCADE will remove from all workspaces and delete related data)
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
