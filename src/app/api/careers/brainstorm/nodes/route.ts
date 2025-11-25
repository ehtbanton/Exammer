import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// GET - Retrieve brainstorm nodes for a session
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

    // Get all nodes for this session
    const nodes = await db.all(
      `SELECT
        id,
        node_id,
        label,
        position_x,
        position_y,
        is_root,
        parent_node_id,
        created_at
      FROM brainstorm_nodes
      WHERE session_id = ?
      ORDER BY created_at ASC`,
      [sessionId]
    );

    return NextResponse.json({
      nodes: nodes.map((node: any) => ({
        id: node.node_id,
        label: node.label,
        position: { x: node.position_x, y: node.position_y },
        isRoot: node.is_root === 1,
        parentNodeId: node.parent_node_id,
      })),
    });
  } catch (error) {
    console.error('Error fetching brainstorm nodes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nodes' },
      { status: 500 }
    );
  }
}
