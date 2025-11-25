import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

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
    const { sessionId, university, course, typicalOffer, requiredSubjects } = body;

    if (!sessionId || !university || !course) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, university, course' },
        { status: 400 }
      );
    }

    // Verify user owns this session
    const careerSession = await db.get<{ user_id: number }>(
      'SELECT user_id FROM career_sessions WHERE id = ?',
      [sessionId]
    );

    if (!careerSession || careerSession.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Session not found or unauthorized' },
        { status: 403 }
      );
    }

    // Check if goal already exists for this session
    const existingGoal = await db.get<{ id: number }>(
      'SELECT id FROM career_goals WHERE session_id = ?',
      [sessionId]
    );

    if (existingGoal) {
      // Update existing goal
      await db.run(
        `UPDATE career_goals
         SET university_name = ?,
             course_name = ?,
             entry_requirements = ?,
             required_subjects = ?,
             updated_at = unixepoch()
         WHERE id = ?`,
        [
          university,
          course,
          typicalOffer || null,
          requiredSubjects ? JSON.stringify(requiredSubjects) : null,
          existingGoal.id,
        ]
      );

      return NextResponse.json({
        goalId: existingGoal.id,
        message: 'Goal updated successfully',
      });
    } else {
      // Create new goal
      const result = await db.run(
        `INSERT INTO career_goals (
          session_id,
          university_name,
          course_name,
          entry_requirements,
          required_subjects
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          sessionId,
          university,
          course,
          typicalOffer || null,
          requiredSubjects ? JSON.stringify(requiredSubjects) : null,
        ]
      );

      return NextResponse.json({
        goalId: result.lastID,
        message: 'Goal created successfully',
      }, { status: 201 });
    }
  } catch (error) {
    console.error('Error saving career goal:', error);
    return NextResponse.json(
      { error: 'Failed to save goal' },
      { status: 500 }
    );
  }
}

// GET - Retrieve goal for a session
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

    // Verify user owns this session
    const careerSession = await db.get<{ user_id: number }>(
      'SELECT user_id FROM career_sessions WHERE id = ?',
      [sessionId]
    );

    if (!careerSession || careerSession.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Session not found or unauthorized' },
        { status: 403 }
      );
    }

    // Get goal
    const goal = await db.get(
      `SELECT
        id,
        university_name,
        course_name,
        entry_requirements,
        required_subjects,
        created_at,
        updated_at
      FROM career_goals
      WHERE session_id = ?`,
      [sessionId]
    );

    if (!goal) {
      return NextResponse.json({ goal: null });
    }

    return NextResponse.json({ goal });
  } catch (error) {
    console.error('Error fetching career goal:', error);
    return NextResponse.json(
      { error: 'Failed to fetch goal' },
      { status: 500 }
    );
  }
}
