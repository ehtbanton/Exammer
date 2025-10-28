import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import type { Topic } from '@/lib/db';

// GET /api/paper-types/[id]/topics - Get all topics for a paper type (workspace members)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id: paperTypeId } = await params;

    // Verify subject is in user's workspace
    const workspace = await db.get<{ subject_id: number }>(
      `SELECT pt.subject_id
       FROM paper_types pt
       WHERE pt.id = ?`,
      [paperTypeId]
    );

    if (!workspace) {
      return NextResponse.json({ error: 'Paper type not found' }, { status: 404 });
    }

    const inWorkspace = await db.get(
      'SELECT id FROM user_workspaces WHERE user_id = ? AND subject_id = ?',
      [user.id, workspace.subject_id]
    );

    if (!inWorkspace) {
      return NextResponse.json({ error: 'Paper type not found in workspace' }, { status: 404 });
    }

    const topics = await db.all<Topic>(
      'SELECT * FROM topics WHERE paper_type_id = ?',
      [paperTypeId]
    );

    return NextResponse.json(topics);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching topics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/paper-types/[id]/topics - Add a topic to a paper type (creators only)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id: paperTypeId } = await params;
    const { name, description } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Get subject_id for this paper type
    const paperType = await db.get<{ subject_id: number }>(
      'SELECT subject_id FROM paper_types WHERE id = ?',
      [paperTypeId]
    );

    if (!paperType) {
      return NextResponse.json({ error: 'Paper type not found' }, { status: 404 });
    }

    // Verify user is the creator
    const workspace = await db.get<{ is_creator: number }>(
      'SELECT is_creator FROM user_workspaces WHERE user_id = ? AND subject_id = ?',
      [user.id, paperType.subject_id]
    );

    if (!workspace || workspace.is_creator !== 1) {
      return NextResponse.json({ error: 'Only creators can add topics' }, { status: 403 });
    }

    const result = await db.run(
      'INSERT INTO topics (paper_type_id, name, description) VALUES (?, ?, ?)',
      [paperTypeId, name, description || null]
    );

    const topic = await db.get<Topic>('SELECT * FROM topics WHERE id = ?', [result.lastID]);

    return NextResponse.json(topic, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating topic:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
