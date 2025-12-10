import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// POST /api/careers/brainstorm/select - Mark a node as selected on the golden path
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
    const { sessionId, nodeId, selected, clearOthers } = body;

    if (!sessionId || !nodeId) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, nodeId' },
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

    // If clearOthers is true, clear all selections first (for changing path)
    if (clearOthers) {
      await db.run(
        'UPDATE brainstorm_nodes SET selected = 0 WHERE session_id = ?',
        [sessionId]
      );
    }

    // Update the selected status for this node
    await db.run(
      'UPDATE brainstorm_nodes SET selected = ? WHERE session_id = ? AND node_id = ?',
      [selected ? 1 : 0, sessionId, nodeId]
    );

    // If deselecting, also deselect all descendants
    if (!selected) {
      await db.run(
        `UPDATE brainstorm_nodes
         SET selected = 0
         WHERE session_id = ? AND node_id LIKE ?`,
        [sessionId, `${nodeId}-%`]
      );
    }

    // Get the updated selected path
    const selectedPath = await db.all<{ node_id: string; label: string; level: number }>(
      `SELECT node_id, label, level
       FROM brainstorm_nodes
       WHERE session_id = ? AND selected = 1
       ORDER BY level ASC`,
      [sessionId]
    );

    return NextResponse.json({
      success: true,
      selectedPath: selectedPath.map(n => ({ id: n.node_id, label: n.label }))
    });
  } catch (error) {
    console.error('Error selecting node:', error);
    return NextResponse.json(
      { error: 'Failed to select node' },
      { status: 500 }
    );
  }
}

// GET /api/careers/brainstorm/select - Get the current selected path
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId parameter' },
        { status: 400 }
      );
    }

    // Get user ID
    const user = await db.get<{ id: number }>(
      'SELECT id FROM users WHERE email = ?',
      [session.user.email]
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
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

    // Get selected path
    const selectedPath = await db.all<{ node_id: string; label: string; level: number }>(
      `SELECT node_id, label, level
       FROM brainstorm_nodes
       WHERE session_id = ? AND selected = 1
       ORDER BY level ASC`,
      [parseInt(sessionId)]
    );

    return NextResponse.json({
      selectedPath: selectedPath.map(n => ({ id: n.node_id, label: n.label }))
    });
  } catch (error) {
    console.error('Error getting selected path:', error);
    return NextResponse.json(
      { error: 'Failed to get selected path' },
      { status: 500 }
    );
  }
}
