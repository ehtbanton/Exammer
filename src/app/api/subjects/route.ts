import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import type { Subject, PastPaper, PaperType } from '@/lib/db';

export const dynamic = 'force-dynamic'; // Prevent caching to always get fresh data

// GET /api/subjects - DEPRECATED: Now only serves search results (filter=other)
// Use /api/subjects/list for main workspace subjects
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter');
    const search = searchParams.get('search');

    // This endpoint now ONLY serves the "other subjects" search feature
    if (filter !== 'other') {
      return NextResponse.json(
        { error: 'This endpoint only supports filter=other. Use /api/subjects/list for workspace subjects.' },
        { status: 400 }
      );
    }

    // Get user's access level
    const fullUser = await db.get<{ access_level: number }>(
      'SELECT access_level FROM users WHERE id = ?',
      [user.id]
    );

    const accessLevel = fullUser?.access_level || 0;

    // Level 1 users (students) cannot search for other subjects
    if (accessLevel === 1) {
      return NextResponse.json([]);
    }

    // Level 2+ users (teachers and admins) can search for subjects not in workspace
    // Return lightweight preview data only (no full question hierarchy)
    let subjectPreviews: any[];

    if (search && search.trim()) {
      subjectPreviews = await db.all<any>(
        `SELECT
           s.id,
           s.name,
           0 as is_creator,
           (SELECT COUNT(*) FROM paper_types WHERE subject_id = s.id) as paper_types_count
         FROM subjects s
         WHERE s.id NOT IN (
           SELECT subject_id FROM user_workspaces WHERE user_id = ?
         )
         AND s.name LIKE ?
         ORDER BY s.created_at DESC`,
        [user.id, `%${search.trim()}%`]
      );
    } else {
      subjectPreviews = await db.all<any>(
        `SELECT
           s.id,
           s.name,
           0 as is_creator,
           (SELECT COUNT(*) FROM paper_types WHERE subject_id = s.id) as paper_types_count
         FROM subjects s
         WHERE s.id NOT IN (
           SELECT subject_id FROM user_workspaces WHERE user_id = ?
         )
         ORDER BY s.created_at DESC`,
        [user.id]
      );
    }

    return NextResponse.json(subjectPreviews);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching subjects:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/subjects - Create a new subject and add to user's workspace
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    // Check user's access level - students (level 1) cannot create subjects
    const fullUser = await db.get<{ access_level: number }>(
      'SELECT access_level FROM users WHERE id = ?',
      [user.id]
    );

    if (!fullUser || fullUser.access_level < 2) {
      return NextResponse.json(
        { error: 'Students cannot create subjects. Only teachers (level 2+) can create subjects.' },
        { status: 403 }
      );
    }

    const { name, syllabusContent, classId } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Subject name is required' }, { status: 400 });
    }

    // If classId is provided, verify the user is a teacher of that class
    if (classId) {
      const isTeacher = await db.get<{ role: string; status: string }>(
        `SELECT role, status FROM class_memberships
         WHERE class_id = ? AND user_id = ? AND role = 'teacher' AND status = 'approved'`,
        [classId, user.id]
      );

      if (!isTeacher) {
        return NextResponse.json(
          { error: 'You must be a teacher of the class to create class-specific subjects' },
          { status: 403 }
        );
      }
    }

    // Create the subject
    const result = await db.run(
      'INSERT INTO subjects (name, syllabus_content, class_id) VALUES (?, ?, ?)',
      [name, syllabusContent || null, classId || null]
    );

    const subjectId = result.lastID;

    // Add to user's workspace as creator
    await db.run(
      'INSERT INTO user_workspaces (user_id, subject_id, is_creator) VALUES (?, ?, 1)',
      [user.id, subjectId]
    );

    // If classId is provided, also add to class_subjects
    if (classId) {
      await db.run(
        'INSERT INTO class_subjects (class_id, subject_id, added_by_user_id) VALUES (?, ?, ?)',
        [classId, subjectId, user.id]
      );
    }

    const subject = await db.get<Subject>('SELECT * FROM subjects WHERE id = ?', [subjectId]);

    return NextResponse.json(subject, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating subject:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
