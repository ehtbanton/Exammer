import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import type { Topic } from '@/lib/db';

// GET /api/paper-types/[id]/topics - Get all topics for a paper type
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const paperTypeId = params.id;

    // Verify user owns the subject that this paper_type belongs to
    const ownership = await db.get<{ user_id: number }>(
      `SELECT s.user_id
       FROM paper_types pt
       JOIN subjects s ON pt.subject_id = s.id
       WHERE pt.id = ?`,
      [paperTypeId]
    );

    if (!ownership || ownership.user_id.toString() !== user.id) {
      return NextResponse.json({ error: 'Paper type not found' }, { status: 404 });
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

// POST /api/paper-types/[id]/topics - Add a topic to a paper type
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const paperTypeId = params.id;
    const { name, description } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Verify user owns the subject that this paper_type belongs to
    const ownership = await db.get<{ user_id: number }>(
      `SELECT s.user_id
       FROM paper_types pt
       JOIN subjects s ON pt.subject_id = s.id
       WHERE pt.id = ?`,
      [paperTypeId]
    );

    if (!ownership || ownership.user_id.toString() !== user.id) {
      return NextResponse.json({ error: 'Paper type not found' }, { status: 404 });
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
