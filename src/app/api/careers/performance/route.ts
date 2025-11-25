import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { analyzeWeakTopics } from '@/ai/flows/analyze-weak-topics';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user ID
    const user = await db.get<{ id: number }>(
      'SELECT id FROM users WHERE email = ?',
      [session.user.email]
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing required parameter: sessionId' },
        { status: 400 }
      );
    }

    // Verify user owns this session and get goal data
    const careerSession = await db.get<{
      user_id: number;
      use_exammer_data: number;
    }>(
      'SELECT user_id, use_exammer_data FROM career_sessions WHERE id = ?',
      [sessionId]
    );

    if (!careerSession || careerSession.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Session not found or unauthorized' },
        { status: 403 }
      );
    }

    // Check if user has enabled Exammer data integration
    if (!careerSession.use_exammer_data) {
      return NextResponse.json({
        weakTopics: [],
        overallAssessment: 'Exammer performance data integration is disabled for this session.',
      });
    }

    // Get goal with required subjects
    const goal = await db.get<{
      required_subjects: string | null;
    }>(
      'SELECT required_subjects FROM career_goals WHERE session_id = ?',
      [sessionId]
    );

    let requiredSubjects: string[] = [];
    if (goal?.required_subjects) {
      try {
        requiredSubjects = JSON.parse(goal.required_subjects);
      } catch (e) {
        requiredSubjects = [];
      }
    }

    // Fetch user's performance data aggregated by topic
    const performanceData = await db.all<{
      subject_name: string;
      paper_type_name: string;
      topic_name: string;
      topic_id: number;
      avg_score: number;
      total_attempts: number;
      questions_count: number;
    }>(
      `SELECT
        s.name as subject_name,
        pt.name as paper_type_name,
        t.name as topic_name,
        t.id as topic_id,
        ROUND(AVG(up.score), 2) as avg_score,
        SUM(up.attempts) as total_attempts,
        COUNT(DISTINCT q.id) as questions_count
      FROM user_progress up
      JOIN questions q ON up.question_id = q.id
      JOIN topics t ON q.topic_id = t.id
      JOIN paper_types pt ON t.paper_type_id = pt.id
      JOIN subjects s ON pt.subject_id = s.id
      WHERE up.user_id = ?
      GROUP BY t.id
      HAVING questions_count > 0
      ORDER BY avg_score ASC`,
      [user.id]
    );

    // If no performance data, return empty
    if (performanceData.length === 0) {
      return NextResponse.json({
        weakTopics: [],
        overallAssessment: 'No performance data available yet. Start practicing questions in Exammer to get personalized recommendations!',
      });
    }

    // Transform data for AI analysis
    const topicsPerformance = performanceData.map(row => ({
      subjectName: row.subject_name,
      paperTypeName: row.paper_type_name,
      topicName: row.topic_name,
      topicId: row.topic_id,
      averageScore: row.avg_score,
      totalAttempts: row.total_attempts,
      questionsCount: row.questions_count,
    }));

    // Call AI to analyze and identify weak topics
    const analysis = await analyzeWeakTopics({
      topicsPerformance,
      requiredSubjects,
    });

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Error analyzing performance:', error);
    return NextResponse.json(
      { error: 'Failed to analyze performance' },
      { status: 500 }
    );
  }
}
