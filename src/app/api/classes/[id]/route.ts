import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

interface Class {
  id: number;
  name: string;
  description: string | null;
  teacher_id: number;
  classroom_code: string;
  created_at: number;
  updated_at: number;
}

// Helper to check if user is a teacher of the class
async function isClassTeacher(classId: number, userId: number): Promise<boolean> {
  const membership = await db.get<{ role: string; status: string }>(
    `SELECT role, status FROM class_memberships
     WHERE class_id = ? AND user_id = ? AND role = 'teacher' AND status = 'approved'`,
    [classId, userId]
  );

  return !!membership;
}

// Helper to check if user is a member of the class (any role, approved)
async function isClassMember(classId: number, userId: number): Promise<boolean> {
  const membership = await db.get<{ status: string }>(
    `SELECT status FROM class_memberships
     WHERE class_id = ? AND user_id = ? AND status = 'approved'`,
    [classId, userId]
  );

  return !!membership;
}

// GET /api/classes/[id] - Get class details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const classId = parseInt(id);

    if (isNaN(classId)) {
      return NextResponse.json({ error: 'Invalid class ID' }, { status: 400 });
    }

    // Check if user is a member of this class
    const isMember = await isClassMember(classId, user.id);

    if (!isMember) {
      return NextResponse.json({ error: 'Access denied. You are not a member of this class.' }, { status: 403 });
    }

    // Get class details
    const classData = await db.get<Class>(
      'SELECT * FROM classes WHERE id = ?',
      [classId]
    );

    if (!classData) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    // Get additional stats
    const stats = await db.get<{
      member_count: number;
      pending_count: number;
      subject_count: number;
    }>(
      `SELECT
        (SELECT COUNT(*) FROM class_memberships WHERE class_id = ? AND status = 'approved') as member_count,
        (SELECT COUNT(*) FROM class_memberships WHERE class_id = ? AND status = 'pending') as pending_count,
        (SELECT COUNT(*) FROM class_subjects WHERE class_id = ?) as subject_count`,
      [classId, classId, classId]
    );

    return NextResponse.json({
      ...classData,
      ...stats
    });
  } catch (error: any) {
    console.error('Error fetching class:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch class' }, { status: 500 });
  }
}

// PUT /api/classes/[id] - Update class (teacher only)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const classId = parseInt(id);

    if (isNaN(classId)) {
      return NextResponse.json({ error: 'Invalid class ID' }, { status: 400 });
    }

    // Check if user is a teacher of this class
    const isTeacher = await isClassTeacher(classId, user.id);

    if (!isTeacher) {
      return NextResponse.json(
        { error: 'Only teachers can update class details' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, description } = body;

    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return NextResponse.json({ error: 'Class name cannot be empty' }, { status: 400 });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }

    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description?.trim() || null);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push('updated_at = unixepoch()');
    values.push(classId);

    await db.run(
      `UPDATE classes SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Fetch updated class
    const updatedClass = await db.get<Class>(
      'SELECT * FROM classes WHERE id = ?',
      [classId]
    );

    return NextResponse.json(updatedClass);
  } catch (error: any) {
    console.error('Error updating class:', error);
    return NextResponse.json({ error: error.message || 'Failed to update class' }, { status: 500 });
  }
}

// DELETE /api/classes/[id] - Delete class (teacher only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const classId = parseInt(id);

    if (isNaN(classId)) {
      return NextResponse.json({ error: 'Invalid class ID' }, { status: 400 });
    }

    // Check if user is a teacher of this class
    const isTeacher = await isClassTeacher(classId, user.id);

    if (!isTeacher) {
      return NextResponse.json(
        { error: 'Only teachers can delete classes' },
        { status: 403 }
      );
    }

    // Delete the class (CASCADE will handle memberships and class_subjects)
    await db.run('DELETE FROM classes WHERE id = ?', [classId]);

    return NextResponse.json({ success: true, message: 'Class deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting class:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete class' }, { status: 500 });
  }
}
