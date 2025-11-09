import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import { generateClassroomCode } from '@/lib/utils';

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

interface ClassMembership {
  id: number;
  class_id: number;
  user_id: number;
  role: 'teacher' | 'student';
  status: 'pending' | 'approved' | 'rejected';
  joined_at: number;
}

// GET /api/classes - Get all classes user is part of (as teacher or student)
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role'); // 'teacher' or 'student' filter

    // Get classes where user is a member (as teacher or student)
    let query = `
      SELECT
        c.*,
        cm.role as user_role,
        cm.status as membership_status,
        (SELECT COUNT(*) FROM class_memberships WHERE class_id = c.id AND status = 'approved') as member_count,
        (SELECT COUNT(*) FROM class_memberships WHERE class_id = c.id AND status = 'pending') as pending_count,
        (SELECT COUNT(*) FROM class_subjects WHERE class_id = c.id) as subject_count
      FROM classes c
      INNER JOIN class_memberships cm ON c.id = cm.class_id
      WHERE cm.user_id = ?
    `;

    const params: any[] = [user.id];

    if (role === 'teacher') {
      query += ` AND cm.role = 'teacher'`;
    } else if (role === 'student') {
      query += ` AND cm.role = 'student'`;
    }

    query += ` ORDER BY c.created_at DESC`;

    const classes = await db.all<Class & {
      user_role: string;
      membership_status: string;
      member_count: number;
      pending_count: number;
      subject_count: number;
    }>(query, params);

    return NextResponse.json(classes);
  } catch (error: any) {
    console.error('Error fetching classes:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch classes' }, { status: 500 });
  }
}

// POST /api/classes - Create a new class (teacher only - level 2+)
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    // Check if user is level 2 or higher (teacher or admin)
    const fullUser = await db.get<{ access_level: number }>(
      'SELECT access_level FROM users WHERE id = ?',
      [user.id]
    );

    if (!fullUser || fullUser.access_level < 2) {
      return NextResponse.json(
        { error: 'Only teachers (level 2+) can create classes' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Class name is required' }, { status: 400 });
    }

    // Generate a unique classroom code
    let classroomCode = generateClassroomCode();
    let attempts = 0;
    const maxAttempts = 10;

    // Ensure the code is unique (very unlikely to collide, but let's be safe)
    while (attempts < maxAttempts) {
      const existing = await db.get(
        'SELECT id FROM classes WHERE classroom_code = ?',
        [classroomCode]
      );

      if (!existing) {
        break;
      }

      classroomCode = generateClassroomCode();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: 'Failed to generate unique classroom code. Please try again.' },
        { status: 500 }
      );
    }

    // Create the class
    const result = await db.run(
      `INSERT INTO classes (name, description, teacher_id, classroom_code)
       VALUES (?, ?, ?, ?)`,
      [name.trim(), description?.trim() || null, user.id, classroomCode]
    );

    // Automatically add the creator as a teacher member with approved status
    await db.run(
      `INSERT INTO class_memberships (class_id, user_id, role, status)
       VALUES (?, ?, 'teacher', 'approved')`,
      [result.lastID, user.id]
    );

    // Fetch the created class
    const newClass = await db.get<Class>(
      'SELECT * FROM classes WHERE id = ?',
      [result.lastID]
    );

    return NextResponse.json(newClass, { status: 201 });
  } catch (error: any) {
    console.error('Error creating class:', error);
    return NextResponse.json({ error: error.message || 'Failed to create class' }, { status: 500 });
  }
}
