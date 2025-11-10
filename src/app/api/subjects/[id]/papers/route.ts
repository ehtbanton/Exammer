import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import type { Subject, PastPaper } from '@/lib/db';

// POST /api/subjects/[id]/papers - Add a past paper to a subject
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id: subjectId } = await params;
    const { name, content, paper_type_id } = await req.json();

    if (!name || !content || !paper_type_id) {
      return NextResponse.json({ error: 'Name, content, and paper_type_id are required' }, { status: 400 });
    }

    // Verify paper type exists and belongs to this subject
    const paperType = await db.get(
      'SELECT id FROM paper_types WHERE id = ? AND subject_id = ?',
      [paper_type_id, subjectId]
    );

    if (!paperType) {
      return NextResponse.json({ error: 'Invalid paper type for this subject' }, { status: 400 });
    }

    // Verify ownership via user_workspaces
    const workspace = await db.get<{ is_creator: number }>(
      'SELECT is_creator FROM user_workspaces WHERE user_id = ? AND subject_id = ?',
      [user.id, subjectId]
    );

    if (!workspace) {
      return NextResponse.json({ error: 'Subject not found or access denied' }, { status: 404 });
    }

    if (workspace.is_creator !== 1) {
      return NextResponse.json({ error: 'Only creators can add past papers' }, { status: 403 });
    }

    const result = await db.run(
      'INSERT INTO past_papers (subject_id, paper_type_id, name, content) VALUES (?, ?, ?, ?)',
      [subjectId, paper_type_id, name, content]
    );

    const paper = await db.get<PastPaper>('SELECT * FROM past_papers WHERE id = ?', [result.lastID]);

    return NextResponse.json(paper, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating past paper:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
