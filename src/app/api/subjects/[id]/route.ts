import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import type { Subject, PastPaper, PaperType } from '@/lib/db';

// GET /api/subjects/[id] - Get a specific subject
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const subjectId = params.id;

    const subject = await db.get<Subject>(
      'SELECT * FROM subjects WHERE id = ? AND user_id = ?',
      [subjectId, user.id]
    );

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    const pastPapers = await db.all<PastPaper>(
      'SELECT * FROM past_papers WHERE subject_id = ?',
      [subjectId]
    );

    const paperTypes = await db.all<PaperType>(
      'SELECT * FROM paper_types WHERE subject_id = ?',
      [subjectId]
    );

    return NextResponse.json({
      ...subject,
      pastPapers,
      paperTypes,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching subject:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/subjects/[id] - Update a subject
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const subjectId = params.id;
    const { name, syllabusContent } = await req.json();

    // Verify ownership
    const subject = await db.get<Subject>(
      'SELECT * FROM subjects WHERE id = ? AND user_id = ?',
      [subjectId, user.id]
    );

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    await db.run(
      'UPDATE subjects SET name = ?, syllabus_content = ?, updated_at = unixepoch() WHERE id = ?',
      [name || subject.name, syllabusContent !== undefined ? syllabusContent : subject.syllabus_content, subjectId]
    );

    const updatedSubject = await db.get<Subject>('SELECT * FROM subjects WHERE id = ?', [subjectId]);

    return NextResponse.json(updatedSubject);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating subject:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/subjects/[id] - Delete a subject
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const subjectId = params.id;

    // Verify ownership
    const subject = await db.get<Subject>(
      'SELECT * FROM subjects WHERE id = ? AND user_id = ?',
      [subjectId, user.id]
    );

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    await db.run('DELETE FROM subjects WHERE id = ?', [subjectId]);

    return NextResponse.json({ message: 'Subject deleted successfully' });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error deleting subject:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
