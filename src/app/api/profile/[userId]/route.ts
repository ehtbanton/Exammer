import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface ProfileUser {
  id: number;
  name: string | null;
  image: string | null;
  created_at: number;
}

interface SubjectStats {
  subject_id: number;
  subject_name: string;
  paper_type_id: number;
  paper_type_name: string;
  topic_id: number;
  topic_name: string;
  questions_attempted: number;
  questions_mastered: number;
  total_questions: number;
  avg_score: number | null;
}

interface DailyActivity {
  date: string;
  count: number;
}

// GET /api/profile/[userId] - Get public profile data
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const userIdNum = parseInt(userId);

    if (isNaN(userIdNum)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    // Get user basic info (PUBLIC - no email exposed)
    const user = await db.get<ProfileUser>(
      `SELECT id, name, image, created_at FROM users WHERE id = ?`,
      [userIdNum]
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get overall summary stats
    const summaryStats = await db.get<{
      questions_attempted: number;
      questions_mastered: number;
      avg_score: number | null;
      total_study_days: number;
    }>(
      `SELECT
        COUNT(*) as questions_attempted,
        SUM(CASE WHEN score >= 80 THEN 1 ELSE 0 END) as questions_mastered,
        AVG(score) as avg_score,
        COUNT(DISTINCT DATE(updated_at, 'unixepoch')) as total_study_days
      FROM user_progress
      WHERE user_id = ? AND attempts > 0`,
      [userIdNum]
    );

    // Get subjects count
    const subjectsCount = await db.get<{ count: number }>(
      `SELECT COUNT(DISTINCT s.id) as count
       FROM user_workspaces uw
       INNER JOIN subjects s ON uw.subject_id = s.id
       WHERE uw.user_id = ?`,
      [userIdNum]
    );

    // Get subject breakdown with paper types and topics
    const subjectBreakdown = await db.all<SubjectStats>(
      `SELECT
        s.id as subject_id,
        s.name as subject_name,
        pt.id as paper_type_id,
        pt.name as paper_type_name,
        t.id as topic_id,
        t.name as topic_name,
        COUNT(DISTINCT CASE WHEN up.attempts > 0 THEN q.id END) as questions_attempted,
        COUNT(DISTINCT CASE WHEN up.score >= 80 THEN q.id END) as questions_mastered,
        COUNT(DISTINCT q.id) as total_questions,
        AVG(CASE WHEN up.attempts > 0 THEN up.score ELSE NULL END) as avg_score
      FROM user_workspaces uw
      INNER JOIN subjects s ON uw.subject_id = s.id
      INNER JOIN paper_types pt ON pt.subject_id = s.id
      INNER JOIN topics t ON t.paper_type_id = pt.id
      LEFT JOIN questions q ON q.topic_id = t.id
      LEFT JOIN user_progress up ON up.question_id = q.id AND up.user_id = ?
      WHERE uw.user_id = ?
      GROUP BY s.id, pt.id, t.id
      HAVING total_questions > 0
      ORDER BY s.name, pt.name, t.name`,
      [userIdNum, userIdNum]
    );

    // Get daily activity for heatmap (last 365 days)
    const oneYearAgo = Math.floor(Date.now() / 1000) - (365 * 24 * 60 * 60);
    const dailyActivity = await db.all<DailyActivity>(
      `SELECT
        DATE(updated_at, 'unixepoch') as date,
        COUNT(*) as count
      FROM user_progress
      WHERE user_id = ?
        AND attempts > 0
        AND updated_at >= ?
      GROUP BY DATE(updated_at, 'unixepoch')
      ORDER BY date`,
      [userIdNum, oneYearAgo]
    );

    // Calculate current streak and longest streak
    const { currentStreak, longestStreak } = calculateStreaks(dailyActivity);

    // Structure subjects hierarchically
    const subjects = structureSubjects(subjectBreakdown);

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name || 'Anonymous User',
        image: user.image,
        memberSince: new Date(user.created_at * 1000).toISOString()
      },
      summary: {
        questionsAttempted: summaryStats?.questions_attempted || 0,
        questionsMastered: summaryStats?.questions_mastered || 0,
        avgScore: summaryStats?.avg_score ? Math.round(summaryStats.avg_score * 10) / 10 : null,
        subjectsCount: subjectsCount?.count || 0,
        totalStudyDays: summaryStats?.total_study_days || 0,
        currentStreak,
        longestStreak
      },
      subjects,
      activity: dailyActivity,
      verification: {
        profileUrl: `${process.env.NEXTAUTH_URL || ''}/profile/${userIdNum}`,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

// Calculate current and longest streak from daily activity
function calculateStreaks(dailyActivity: DailyActivity[]): { currentStreak: number; longestStreak: number } {
  if (dailyActivity.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const activityDates = new Set(dailyActivity.map(a => a.date));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate current streak (consecutive days ending today or yesterday)
  let currentStreak = 0;
  let checkDate = new Date(today);

  // Check if today has activity, if not start from yesterday
  const todayStr = checkDate.toISOString().split('T')[0];
  if (!activityDates.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0];
    if (activityDates.has(dateStr)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate: Date | null = null;

  const sortedDates = Array.from(activityDates).sort();

  for (const dateStr of sortedDates) {
    const currentDate = new Date(dateStr);

    if (prevDate) {
      const diffDays = Math.round((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    } else {
      tempStreak = 1;
    }

    prevDate = currentDate;
  }

  longestStreak = Math.max(longestStreak, tempStreak);

  return { currentStreak, longestStreak };
}

// Structure flat subject data into hierarchical format
function structureSubjects(breakdown: SubjectStats[]) {
  const subjectsMap = new Map<number, {
    id: number;
    name: string;
    questionsAttempted: number;
    questionsMastered: number;
    totalQuestions: number;
    avgScore: number | null;
    paperTypes: Map<number, {
      id: number;
      name: string;
      topics: Array<{
        id: number;
        name: string;
        questionsAttempted: number;
        questionsMastered: number;
        totalQuestions: number;
        avgScore: number | null;
      }>;
    }>;
  }>();

  for (const row of breakdown) {
    // Get or create subject
    if (!subjectsMap.has(row.subject_id)) {
      subjectsMap.set(row.subject_id, {
        id: row.subject_id,
        name: row.subject_name,
        questionsAttempted: 0,
        questionsMastered: 0,
        totalQuestions: 0,
        avgScore: null,
        paperTypes: new Map()
      });
    }
    const subject = subjectsMap.get(row.subject_id)!;

    // Get or create paper type
    if (!subject.paperTypes.has(row.paper_type_id)) {
      subject.paperTypes.set(row.paper_type_id, {
        id: row.paper_type_id,
        name: row.paper_type_name,
        topics: []
      });
    }
    const paperType = subject.paperTypes.get(row.paper_type_id)!;

    // Add topic
    paperType.topics.push({
      id: row.topic_id,
      name: row.topic_name,
      questionsAttempted: row.questions_attempted,
      questionsMastered: row.questions_mastered,
      totalQuestions: row.total_questions,
      avgScore: row.avg_score ? Math.round(row.avg_score * 10) / 10 : null
    });

    // Aggregate to subject level
    subject.questionsAttempted += row.questions_attempted;
    subject.questionsMastered += row.questions_mastered;
    subject.totalQuestions += row.total_questions;
  }

  // Calculate subject-level averages and convert to array
  return Array.from(subjectsMap.values()).map(subject => {
    // Calculate weighted average score for subject
    let totalScore = 0;
    let totalAttempted = 0;

    for (const pt of subject.paperTypes.values()) {
      for (const topic of pt.topics) {
        if (topic.avgScore !== null && topic.questionsAttempted > 0) {
          totalScore += topic.avgScore * topic.questionsAttempted;
          totalAttempted += topic.questionsAttempted;
        }
      }
    }

    return {
      id: subject.id,
      name: subject.name,
      questionsAttempted: subject.questionsAttempted,
      questionsMastered: subject.questionsMastered,
      totalQuestions: subject.totalQuestions,
      avgScore: totalAttempted > 0 ? Math.round((totalScore / totalAttempted) * 10) / 10 : null,
      masteryPercent: subject.totalQuestions > 0
        ? Math.round((subject.questionsMastered / subject.totalQuestions) * 100)
        : 0,
      paperTypes: Array.from(subject.paperTypes.values())
    };
  });
}
