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
    const { sessionId, nodes, edges } = body;

    if (!sessionId || !nodes || !edges) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, nodes, edges' },
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

    // Delete existing nodes for this session
    await db.run('DELETE FROM brainstorm_nodes WHERE session_id = ?', [sessionId]);

    // Insert all nodes
    for (const node of nodes) {
      await db.run(
        `INSERT INTO brainstorm_nodes (
          session_id,
          node_id,
          label,
          position_x,
          position_y,
          is_root,
          parent_node_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          node.id,
          node.label,
          node.position.x,
          node.position.y,
          node.isRoot ? 1 : 0,
          null, // We'll set parent based on edges
        ]
      );
    }

    // Update parent relationships based on edges
    for (const edge of edges) {
      await db.run(
        `UPDATE brainstorm_nodes
         SET parent_node_id = ?
         WHERE session_id = ? AND node_id = ?`,
        [edge.source, sessionId, edge.target]
      );
    }

    // Mark brainstorm as complete
    await db.run(
      'UPDATE career_sessions SET brainstorm_complete = 1, updated_at = unixepoch() WHERE id = ?',
      [sessionId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving brainstorm:', error);
    return NextResponse.json(
      { error: 'Failed to save brainstorm' },
      { status: 500 }
    );
  }
}
