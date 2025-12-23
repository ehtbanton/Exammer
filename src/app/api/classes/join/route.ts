import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// POST /api/classes/join - Request to join a class using classroom code
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await req.json();
    const { classroomCode } = body;

    if (!classroomCode || typeof classroomCode !== 'string') {
      return NextResponse.json({ error: 'Classroom code is required' }, { status: 400 });
    }

    // Find the class by classroom code
    const classData = await db.get<{ id: number; name: string }>(
      'SELECT id, name FROM classes WHERE classroom_code = ?',
      [classroomCode.trim().toUpperCase()]
    );

    if (!classData) {
      return NextResponse.json({ error: 'Invalid classroom code' }, { status: 404 });
    }

    // Check if user is already a member or has a pending request
    const existingMembership = await db.get<{ status: string }>(
      'SELECT status FROM class_memberships WHERE class_id = ? AND user_id = ?',
      [classData.id, user.id]
    );

    if (existingMembership) {
      if (existingMembership.status === 'approved') {
        return NextResponse.json(
          { error: 'You are already a member of this class' },
          { status: 400 }
        );
      } else if (existingMembership.status === 'pending') {
        return NextResponse.json(
          { error: 'You already have a pending request for this class' },
          { status: 400 }
        );
      } else if (existingMembership.status === 'rejected') {
        // Update the rejected membership to pending (allow reapplication)
        await db.run(
          `UPDATE class_memberships
           SET status = 'pending', joined_at = unixepoch()
           WHERE class_id = ? AND user_id = ?`,
          [classData.id, user.id]
        );

        return NextResponse.json(
          {
            message: 'Join request resubmitted successfully',
            className: classData.name,
            classId: classData.id
          },
          { status: 200 }
        );
      }
    }

    // Create a new join request with pending status
    await db.run(
      `INSERT INTO class_memberships (class_id, user_id, role, status)
       VALUES (?, ?, 'student', 'pending')`,
      [classData.id, user.id]
    );

    return NextResponse.json(
      {
        message: 'Join request submitted successfully',
        className: classData.name,
        classId: classData.id
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error joining class:', error);
    return NextResponse.json({ error: error.message || 'Failed to join class' }, { status: 500 });
  }
}
