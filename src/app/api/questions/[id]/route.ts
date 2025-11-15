import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/questions/[id] - Get full question content (only when needed for answering)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: questionIdStr } = await params;
    const questionId = parseInt(questionIdStr);

    if (isNaN(questionId)) {
      return NextResponse.json({ error: 'Invalid question ID' }, { status: 400 });
    }

    // Get question with subject_id for access verification
    const question = await db.get<any>(
      `SELECT
        q.*,
        s.id as subject_id
       FROM questions q
       JOIN topics t ON q.topic_id = t.id
       JOIN paper_types pt ON t.paper_type_id = pt.id
       JOIN subjects s ON pt.subject_id = s.id
       WHERE q.id = ?`,
      [questionId]
    );

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Verify user has access to this subject
    const fullUser = await db.get<{ access_level: number }>(
      'SELECT access_level FROM users WHERE id = ?',
      [user.id]
    );
    const accessLevel = fullUser?.access_level || 0;

    let hasAccess = false;

    if (accessLevel === 1) {
      // Students: check if subject is in an approved class
      const classAccess = await db.get<any>(
        `SELECT 1 FROM subjects s
         INNER JOIN class_subjects cs ON s.id = cs.subject_id
         INNER JOIN class_memberships cm ON cs.class_id = cm.class_id
         WHERE s.id = ? AND cm.user_id = ? AND cm.status = 'approved' AND cm.role = 'student'`,
        [question.subject_id, user.id]
      );
      hasAccess = !!classAccess;
    } else {
      // Teachers: check workspace or class membership
      const workspaceAccess = await db.get<any>(
        'SELECT 1 FROM user_workspaces WHERE user_id = ? AND subject_id = ?',
        [user.id, question.subject_id]
      );
      const classAccess = await db.get<any>(
        `SELECT 1 FROM subjects s
         INNER JOIN class_subjects cs ON s.id = cs.subject_id
         INNER JOIN class_memberships cm ON cs.class_id = cm.class_id
         WHERE s.id = ? AND cm.user_id = ? AND cm.status = 'approved'`,
        [question.subject_id, user.id]
      );
      hasAccess = !!(workspaceAccess || classAccess);
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get user progress
    const progress = await db.get<any>(
      'SELECT * FROM user_progress WHERE user_id = ? AND question_id = ?',
      [user.id, questionId]
    );

    // Parse JSON fields
    let solutionObjectives: string[] | undefined = undefined;
    if (question.solution_objectives) {
      try {
        solutionObjectives = JSON.parse(question.solution_objectives);
      } catch (e) {
        console.error(`Failed to parse solution_objectives for question ${questionId}:`, e);
      }
    }

    let completedObjectives: number[] = [];
    if (progress?.completed_objectives) {
      try {
        completedObjectives = JSON.parse(progress.completed_objectives);
      } catch (e) {
        console.error(`Failed to parse completed_objectives for question ${questionId}:`, e);
      }
    }

    // Return full question content
    const response = {
      id: question.id,
      topic_id: question.topic_id,
      question_text: question.question_text,
      summary: question.summary,
      solution_objectives: solutionObjectives,
      diagram_geogebra: question.diagram_geogebra,
      diagram_bounds: question.diagram_bounds,
      markscheme_id: question.markscheme_id,
      paper_date: question.paper_date,
      question_number: question.question_number,
      categorization_confidence: question.categorization_confidence,
      categorization_reasoning: question.categorization_reasoning,
      score: progress?.score || 0,
      attempts: progress?.attempts || 0,
      completed_objectives: completedObjectives,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching full question:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
