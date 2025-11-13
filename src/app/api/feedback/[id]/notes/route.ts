import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, getUserWithAccessLevel } from '@/lib/auth-helpers';
import type {
  CreateFeedbackNoteRequest,
  CreateFeedbackNoteResponse,
  FeedbackNote,
} from '@/lib/types';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schema for note creation
const createNoteSchema = z.object({
  note: z.string().min(1, 'Note is required').max(5000, 'Note cannot exceed 5000 characters'),
  isInternal: z.boolean().optional().default(true),
});

// POST /api/feedback/[id]/notes - Add a note to feedback (admin only)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<CreateFeedbackNoteResponse>> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check admin permission
    const fullUser = await getUserWithAccessLevel(user.id);
    const isAdmin = fullUser?.access_level === 3;

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const feedbackId = params.id;

    // Check if feedback exists
    const feedback = await db.get<any>(
      'SELECT id FROM feedback WHERE id = ?',
      [feedbackId]
    );

    if (!feedback) {
      return NextResponse.json(
        { success: false, error: 'Feedback not found' },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validation = createNoteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors[0].message
        },
        { status: 400 }
      );
    }

    const { note, isInternal } = validation.data;

    // Insert note
    const result = await db.run<{ lastID: number }>(
      `INSERT INTO feedback_notes (feedback_id, admin_user_id, note, is_internal)
       VALUES (?, ?, ?, ?)`,
      [feedbackId, user.id, note, isInternal ? 1 : 0]
    );

    const noteId = result.lastID;

    // Fetch the created note with admin user name
    const createdNote = await db.get<any>(
      `SELECT
        n.*,
        u.name as admin_user_name
      FROM feedback_notes n
      LEFT JOIN users u ON n.admin_user_id = u.id
      WHERE n.id = ?`,
      [noteId]
    );

    if (!createdNote) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch note after creation' },
        { status: 500 }
      );
    }

    // Transform to FeedbackNote type
    const transformedNote: FeedbackNote = {
      id: String(createdNote.id),
      feedbackId: String(createdNote.feedback_id),
      adminUserId: String(createdNote.admin_user_id),
      adminUserName: createdNote.admin_user_name,
      note: createdNote.note,
      isInternal: Boolean(createdNote.is_internal),
      createdAt: createdNote.created_at,
    };

    // Update feedback updated_at timestamp
    await db.run(
      'UPDATE feedback SET updated_at = unixepoch() WHERE id = ?',
      [feedbackId]
    );

    return NextResponse.json({
      success: true,
      note: transformedNote,
    });
  } catch (error) {
    console.error('Error creating note:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create note'
      },
      { status: 500 }
    );
  }
}
