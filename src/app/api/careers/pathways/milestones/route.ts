import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// PATCH - Update milestone status
export async function PATCH(req: NextRequest) {
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
    const { milestoneId, status, completionNotes } = body;

    if (!milestoneId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: milestoneId, status' },
        { status: 400 }
      );
    }

    // Validate status
    if (!['pending', 'in_progress', 'completed'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be pending, in_progress, or completed' },
        { status: 400 }
      );
    }

    // Verify user owns this milestone (through pathway -> goal -> session)
    const milestone = await db.get<{ pathway_id: number }>(
      'SELECT pathway_id FROM pathway_milestones WHERE id = ?',
      [milestoneId]
    );

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    const pathway = await db.get<{ goal_id: number }>(
      'SELECT goal_id FROM pathways WHERE id = ?',
      [milestone.pathway_id]
    );

    if (!pathway) {
      return NextResponse.json({ error: 'Pathway not found' }, { status: 404 });
    }

    const goal = await db.get<{ session_id: number }>(
      'SELECT session_id FROM career_goals WHERE id = ?',
      [pathway.goal_id]
    );

    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    const careerSession = await db.get<{ user_id: number }>(
      'SELECT user_id FROM career_sessions WHERE id = ?',
      [goal.session_id]
    );

    if (!careerSession || careerSession.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to modify this milestone' },
        { status: 403 }
      );
    }

    // Update milestone
    const completedAt = status === 'completed' ? 'unixepoch()' : 'NULL';
    await db.run(
      `UPDATE pathway_milestones
       SET status = ?,
           completion_notes = ?,
           completed_at = ${completedAt}
       WHERE id = ?`,
      [status, completionNotes || null, milestoneId]
    );

    return NextResponse.json({
      message: 'Milestone updated successfully',
    });
  } catch (error) {
    console.error('Error updating milestone:', error);
    return NextResponse.json(
      { error: 'Failed to update milestone' },
      { status: 500 }
    );
  }
}
