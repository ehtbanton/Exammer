import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - List user's career sessions
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

    // Get all sessions for user
    const sessions = await db.all(
      `SELECT
        id,
        session_type,
        current_school,
        current_year_group,
        target_application_year,
        use_exammer_data,
        brainstorm_complete,
        academic_profile_complete,
        created_at,
        updated_at
      FROM career_sessions
      WHERE user_id = ?
      ORDER BY created_at DESC`,
      [user.id]
    );

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Error fetching career sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch career sessions' },
      { status: 500 }
    );
  }
}

// POST - Create new career session
export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const {
      sessionType,
      userInterests,
      currentSchool,
      currentYearGroup,
      targetApplicationYear,
      useExammerData
    } = body;

    // Validate session type
    if (!sessionType || !['explore', 'direct'].includes(sessionType)) {
      return NextResponse.json(
        { error: 'Invalid session type. Must be "explore" or "direct"' },
        { status: 400 }
      );
    }

    // Create new session
    const result = await db.run(
      `INSERT INTO career_sessions (
        user_id,
        session_type,
        user_interests,
        current_school,
        current_year_group,
        target_application_year,
        use_exammer_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        sessionType,
        userInterests || null,
        currentSchool || null,
        currentYearGroup || null,
        targetApplicationYear || null,
        useExammerData ? 1 : 0
      ]
    );

    // Fetch the created session
    const newSession = await db.get(
      `SELECT
        id,
        session_type,
        current_school,
        current_year_group,
        target_application_year,
        use_exammer_data,
        brainstorm_complete,
        academic_profile_complete,
        created_at,
        updated_at
      FROM career_sessions
      WHERE id = ?`,
      [result.lastID]
    );

    return NextResponse.json({
      sessionId: result.lastID,
      session: newSession
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating career session:', error);
    return NextResponse.json(
      { error: 'Failed to create career session' },
      { status: 500 }
    );
  }
}
