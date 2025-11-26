import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { expandBrainstormNode } from '@/ai/flows/expand-brainstorm-node';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, nodeId, nodeLabel, parentPath } = body;

    if (!sessionId || !nodeId || !nodeLabel) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify user owns this session
    const user = await db.get<{ id: number }>(
      'SELECT id FROM users WHERE email = ?',
      [session.user.email]
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

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

    // Call AI to generate related terms
    const result = await expandBrainstormNode({
      nodeLabel,
      parentPath: parentPath || [],
    });

    return NextResponse.json({
      suggestions: result.suggestions,
    });
  } catch (error) {
    console.error('Error expanding brainstorm node:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Check for rate limit errors
    if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      return NextResponse.json(
        {
          error: 'AI service temporarily unavailable',
          details: isDevelopment ? errorMessage : 'Please try again in a moment'
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to expand node',
        details: isDevelopment ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}
