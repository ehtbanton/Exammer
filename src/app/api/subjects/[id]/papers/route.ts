import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import type { Subject, PastPaper } from '@/lib/db';

// POST /api/subjects/[id]/papers - Add a past paper to a subject
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const subjectId = params.id;
    const { name, content } = await req.json();

    if (!name || !content) {
      return NextResponse.json({ error: 'Name and content are required' }, { status: 400 });
    }

    // Verify ownership
    const subject = await db.get<Subject>(
      'SELECT * FROM subjects WHERE id = ? AND user_id = ?',
      [subjectId, user.id]
    );

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    const result = await db.run(
      'INSERT INTO past_papers (subject_id, name, content) VALUES (?, ?, ?)',
      [subjectId, name, content]
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
