import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { suggestUniversities } from '@/ai/flows/suggest-universities';

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
    const { sessionId, brainstormInterests, directInput } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing required field: sessionId' },
        { status: 400 }
      );
    }

    // Verify user owns this session
    const careerSession = await db.get<{
      user_id: number;
      user_interests: string | null;
      current_year_group: string | null;
      cv_parsed_data: string | null;
    }>(
      'SELECT user_id, user_interests, current_year_group, cv_parsed_data FROM career_sessions WHERE id = ?',
      [sessionId]
    );

    if (!careerSession || careerSession.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Session not found or unauthorized' },
        { status: 403 }
      );
    }

    // Parse CV data if available
    let cvData;
    if (careerSession.cv_parsed_data) {
      try {
        cvData = JSON.parse(careerSession.cv_parsed_data);
      } catch (e) {
        cvData = undefined;
      }
    }

    // Call AI to generate university suggestions
    const result = await suggestUniversities({
      brainstormInterests,
      directInput,
      userInterests: careerSession.user_interests || undefined,
      currentYearGroup: careerSession.current_year_group || undefined,
      cvData,
    });

    return NextResponse.json({
      suggestions: result.suggestions,
    });
  } catch (error) {
    console.error('Error generating university suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}
