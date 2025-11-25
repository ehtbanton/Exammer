import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { expandBrainstormNode } from '@/ai/flows/expand-brainstorm-node';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, nodeId, nodeLabel } = body;

    if (!sessionId || !nodeId || !nodeLabel) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, nodeId, nodeLabel' },
        { status: 400 }
      );
    }

    // TODO: Verify user owns this session (add check against career_sessions table)

    // Extract parent path from nodeId (format: "root" or "root-0" or "root-0-2")
    const pathParts = nodeId.split('-');
    const parentPath: string[] = [];
    // We'll build parent path later when we store node labels in the request

    // Call AI to generate related terms
    const result = await expandBrainstormNode({
      nodeLabel,
      parentPath,
    });

    return NextResponse.json({
      suggestions: result.suggestions,
    });
  } catch (error) {
    console.error('Error expanding brainstorm node:', error);
    return NextResponse.json(
      { error: 'Failed to expand node' },
      { status: 500 }
    );
  }
}
