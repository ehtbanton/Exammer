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

    const user = await db.get<{ id: number }>(
      'SELECT id FROM users WHERE email = ?',
      [session.user.email]
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const { sessionId, subjects } = body;

    if (!sessionId || !subjects) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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

    // Update the career session with the academic profile
    await db.run(
      'UPDATE career_sessions SET academic_profile = ?, academic_profile_complete = 1 WHERE id = ?',
      [JSON.stringify({ subjects }), sessionId]
    );

    return NextResponse.json({ message: 'Academic profile saved' });
  } catch (error) {
    console.error('Error saving academic profile:', error);
    return NextResponse.json(
      { error: 'Failed to save academic profile' },
      { status: 500 }
    );
  }
}
