import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';

// POST /api/workspace - Add a subject to user's workspace
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { subjectId } = await req.json();

    if (!subjectId) {
      return NextResponse.json({ error: 'Subject ID is required' }, { status: 400 });
    }

    // Check if subject exists
    const subject = await db.get('SELECT id FROM subjects WHERE id = ?', [subjectId]);
    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    // Check if already in workspace
    const existing = await db.get(
      'SELECT id FROM user_workspaces WHERE user_id = ? AND subject_id = ?',
      [user.id, subjectId]
    );

    if (existing) {
      return NextResponse.json({ error: 'Subject already in workspace' }, { status: 400 });
    }

    // Add to workspace (not as creator since they didn't create it)
    await db.run(
      'INSERT INTO user_workspaces (user_id, subject_id, is_creator) VALUES (?, ?, 0)',
      [user.id, subjectId]
    );

    return NextResponse.json({ message: 'Subject added to workspace' }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error adding subject to workspace:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/workspace?subjectId=123 - Remove a subject from user's workspace
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const subjectId = searchParams.get('subjectId');

    if (!subjectId) {
      return NextResponse.json({ error: 'Subject ID is required' }, { status: 400 });
    }

    // Check if in workspace
    const workspace = await db.get<{ is_creator: number }>(
      'SELECT is_creator FROM user_workspaces WHERE user_id = ? AND subject_id = ?',
      [user.id, subjectId]
    );

    if (!workspace) {
      return NextResponse.json({ error: 'Subject not in workspace' }, { status: 404 });
    }

    // Cannot remove if creator (would leave subject orphaned in workspace context)
    // Creator should use DELETE /api/subjects/[id] to delete the subject entirely
    if (workspace.is_creator === 1) {
      return NextResponse.json(
        { error: 'Cannot remove created subjects from workspace. Use delete subject instead.' },
        { status: 400 }
      );
    }

    // Remove from workspace
    await db.run(
      'DELETE FROM user_workspaces WHERE user_id = ? AND subject_id = ?',
      [user.id, subjectId]
    );

    return NextResponse.json({ message: 'Subject removed from workspace' });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error removing subject from workspace:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
