import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import type { Subject, PaperType } from '@/lib/db';

// POST /api/subjects/[id]/paper-types - Add a paper type to a subject
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const subjectId = params.id;
    const { name } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
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
      'INSERT INTO paper_types (subject_id, name) VALUES (?, ?)',
      [subjectId, name]
    );

    const paperType = await db.get<PaperType>('SELECT * FROM paper_types WHERE id = ?', [result.lastID]);

    return NextResponse.json(paperType, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating paper type:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
