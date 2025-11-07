import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// Helper to check if user is a teacher of the class
async function isClassTeacher(classId: number, userId: number): Promise<boolean> {
  const membership = await db.get<{ role: string; status: string }>(
    `SELECT role, status FROM class_memberships
     WHERE class_id = ? AND user_id = ? AND role = 'teacher' AND status = 'approved'`,
    [classId, userId]
  );

  return !!membership;
}

// GET /api/classes/[id]/analytics - Get comprehensive analytics for the class
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const classId = parseInt(id);

    if (isNaN(classId)) {
      return NextResponse.json({ error: 'Invalid class ID' }, { status: 400 });
    }

    // Check if user is a teacher of this class
    const isTeacher = await isClassTeacher(classId, user.id);

    if (!isTeacher) {
      return NextResponse.json(
        { error: 'Only teachers can view class analytics' },
        { status: 403 }
      );
    }

    // Get all approved students in the class
    const students = await db.all<{ user_id: number; name: string; email: string }>(
      `SELECT u.id as user_id, u.name, u.email
       FROM class_memberships cm
       INNER JOIN users u ON cm.user_id = u.id
       WHERE cm.class_id = ? AND cm.role = 'student' AND cm.status = 'approved'
       ORDER BY u.name, u.email`,
      [classId]
    );

    if (students.length === 0) {
      return NextResponse.json({
        students: [],
        topicAverages: [],
        overallStats: {
          totalStudents: 0,
          averageScore: 0,
          totalQuestions: 0,
          completionRate: 0
        }
      });
    }

    const studentIds = students.map(s => s.user_id);
    const placeholders = studentIds.map(() => '?').join(',');

    // Get all subjects assigned to this class
    const classSubjects = await db.all<{ subject_id: number }>(
      `SELECT subject_id FROM class_subjects WHERE class_id = ?`,
      [classId]
    );

    if (classSubjects.length === 0) {
      return NextResponse.json({
        students: students.map(s => ({
          ...s,
          averageScore: 0,
          questionsAttempted: 0,
          totalQuestions: 0,
          completionRate: 0
        })),
        topicAverages: [],
        overallStats: {
          totalStudents: students.length,
          averageScore: 0,
          totalQuestions: 0,
          completionRate: 0
        }
      });
    }

    const subjectIds = classSubjects.map(cs => cs.subject_id);
    const subjectPlaceholders = subjectIds.map(() => '?').join(',');

    // Get topic-level average scores
    const topicAverages = await db.all<{
      subject_id: number;
      subject_name: string;
      paper_type_id: number;
      paper_type_name: string;
      topic_id: number;
      topic_name: string;
      average_score: number;
      attempts_count: number;
      total_students: number;
    }>(
      `SELECT
        s.id as subject_id,
        s.name as subject_name,
        pt.id as paper_type_id,
        pt.name as paper_type_name,
        t.id as topic_id,
        t.name as topic_name,
        AVG(COALESCE(up.score, 0)) as average_score,
        COUNT(DISTINCT CASE WHEN up.attempts > 0 THEN up.user_id END) as attempts_count,
        COUNT(DISTINCT cm.user_id) as total_students
      FROM subjects s
      INNER JOIN paper_types pt ON pt.subject_id = s.id
      INNER JOIN topics t ON t.paper_type_id = pt.id
      INNER JOIN questions q ON q.topic_id = t.id
      CROSS JOIN class_memberships cm
      LEFT JOIN user_progress up ON up.question_id = q.id AND up.user_id = cm.user_id
      WHERE s.id IN (${subjectPlaceholders})
        AND cm.class_id = ?
        AND cm.role = 'student'
        AND cm.status = 'approved'
      GROUP BY s.id, pt.id, t.id
      ORDER BY s.name, pt.name, t.name`,
      [...subjectIds, classId]
    );

    // Get individual student statistics
    const studentStats = await db.all<{
      user_id: number;
      total_questions: number;
      questions_attempted: number;
      average_score: number;
    }>(
      `SELECT
        cm.user_id,
        COUNT(DISTINCT q.id) as total_questions,
        COUNT(DISTINCT CASE WHEN up.attempts > 0 THEN q.id END) as questions_attempted,
        AVG(CASE WHEN up.attempts > 0 THEN up.score ELSE 0 END) as average_score
      FROM class_memberships cm
      CROSS JOIN class_subjects cs
      INNER JOIN subjects s ON cs.subject_id = s.id
      INNER JOIN paper_types pt ON pt.subject_id = s.id
      INNER JOIN topics t ON t.paper_type_id = pt.id
      INNER JOIN questions q ON q.topic_id = t.id
      LEFT JOIN user_progress up ON up.question_id = q.id AND up.user_id = cm.user_id
      WHERE cm.class_id = ?
        AND cs.class_id = ?
        AND cm.role = 'student'
        AND cm.status = 'approved'
      GROUP BY cm.user_id`,
      [classId, classId]
    );

    // Merge student data with stats
    const studentsWithStats = students.map(student => {
      const stats = studentStats.find(s => s.user_id === student.user_id);
      return {
        ...student,
        averageScore: stats?.average_score || 0,
        questionsAttempted: stats?.questions_attempted || 0,
        totalQuestions: stats?.total_questions || 0,
        completionRate: stats?.total_questions
          ? ((stats.questions_attempted / stats.total_questions) * 100)
          : 0
      };
    });

    // Calculate overall statistics
    const totalQuestions = studentStats[0]?.total_questions || 0;
    const overallAverageScore = studentStats.reduce((sum, s) => sum + (s.average_score || 0), 0) / students.length || 0;
    const overallCompletionRate = studentStats.reduce(
      (sum, s) => sum + (s.total_questions ? (s.questions_attempted / s.total_questions) * 100 : 0),
      0
    ) / students.length || 0;

    return NextResponse.json({
      students: studentsWithStats,
      topicAverages,
      overallStats: {
        totalStudents: students.length,
        averageScore: Math.round(overallAverageScore * 100) / 100,
        totalQuestions,
        completionRate: Math.round(overallCompletionRate * 100) / 100
      }
    });
  } catch (error: any) {
    console.error('Error fetching class analytics:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch analytics' }, { status: 500 });
  }
}
