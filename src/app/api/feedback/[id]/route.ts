import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, getUserWithAccessLevel } from '@/lib/auth-helpers';
import type {
  UpdateFeedbackRequest,
  UpdateFeedbackResponse,
  Feedback,
  FeedbackWithDetails,
  FeedbackNote,
  FeedbackStatusHistory,
} from '@/lib/types';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schema for feedback updates
const updateFeedbackSchema = z.object({
  status: z.enum(['new', 'in_progress', 'resolved', 'closed', 'archived']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
});

// GET /api/feedback/[id] - Get single feedback with details
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const feedbackId = params.id;

    // Get full user data including access level
    const fullUser = await getUserWithAccessLevel(user.id);
    const isAdmin = fullUser?.access_level === 3;

    // Fetch feedback
    const feedback = await db.get<any>(
      `SELECT
        f.*,
        u.name as user_name,
        u.email as user_email
      FROM feedback f
      LEFT JOIN users u ON f.user_id = u.id
      WHERE f.id = ?`,
      [feedbackId]
    );

    if (!feedback) {
      return NextResponse.json(
        { error: 'Feedback not found' },
        { status: 404 }
      );
    }

    // Check permission: admin or own feedback
    if (!isAdmin && feedback.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Fetch notes
    const notes = await db.all<any>(
      `SELECT
        n.*,
        u.name as admin_user_name
      FROM feedback_notes n
      LEFT JOIN users u ON n.admin_user_id = u.id
      WHERE n.feedback_id = ?
      ORDER BY n.created_at DESC`,
      [feedbackId]
    );

    // Fetch status history
    const statusHistory = await db.all<any>(
      `SELECT
        h.*,
        u.name as admin_user_name
      FROM feedback_status_history h
      LEFT JOIN users u ON h.admin_user_id = u.id
      WHERE h.feedback_id = ?
      ORDER BY h.changed_at DESC`,
      [feedbackId]
    );

    // Transform to FeedbackWithDetails
    const transformedNotes: FeedbackNote[] = notes
      .filter((n: any) => isAdmin || !n.is_internal) // Filter internal notes for non-admins
      .map((n: any) => ({
        id: String(n.id),
        feedbackId: String(n.feedback_id),
        adminUserId: String(n.admin_user_id),
        adminUserName: n.admin_user_name,
        note: n.note,
        isInternal: Boolean(n.is_internal),
        createdAt: n.created_at,
      }));

    const transformedHistory: FeedbackStatusHistory[] = statusHistory.map((h: any) => ({
      id: String(h.id),
      feedbackId: String(h.feedback_id),
      adminUserId: h.admin_user_id ? String(h.admin_user_id) : null,
      adminUserName: h.admin_user_name,
      oldStatus: h.old_status,
      newStatus: h.new_status,
      changedAt: h.changed_at,
    }));

    const result: FeedbackWithDetails = {
      id: String(feedback.id),
      userId: feedback.user_id ? String(feedback.user_id) : null,
      category: feedback.category,
      title: feedback.title,
      description: feedback.description,
      url: feedback.url,
      screenshotUrl: feedback.screenshot_url,
      browserInfo: feedback.browser_info,
      status: feedback.status,
      priority: feedback.priority,
      createdAt: feedback.created_at,
      updatedAt: feedback.updated_at,
      resolvedAt: feedback.resolved_at,
      userName: feedback.user_name,
      userEmail: feedback.user_email,
      notes: transformedNotes,
      statusHistory: transformedHistory,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    );
  }
}

// PATCH /api/feedback/[id] - Update feedback (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<UpdateFeedbackResponse>> {
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

    // Parse and validate request body
    const body = await req.json();
    const validation = updateFeedbackSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors[0].message
        },
        { status: 400 }
      );
    }

    const { status, priority } = validation.data;

    // Check if feedback exists
    const existingFeedback = await db.get<any>(
      'SELECT * FROM feedback WHERE id = ?',
      [feedbackId]
    );

    if (!existingFeedback) {
      return NextResponse.json(
        { success: false, error: 'Feedback not found' },
        { status: 404 }
      );
    }

    // Build update query
    const updates: string[] = [];
    const params: any[] = [];

    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);

      // Add status history entry
      await db.run(
        `INSERT INTO feedback_status_history (feedback_id, admin_user_id, old_status, new_status)
         VALUES (?, ?, ?, ?)`,
        [feedbackId, user.id, existingFeedback.status, status]
      );

      // If status is resolved or closed, set resolved_at
      if ((status === 'resolved' || status === 'closed') && !existingFeedback.resolved_at) {
        updates.push('resolved_at = unixepoch()');
      }
    }

    if (priority !== undefined) {
      updates.push('priority = ?');
      params.push(priority);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updates provided' },
        { status: 400 }
      );
    }

    // Add updated_at and feedbackId to params
    updates.push('updated_at = unixepoch()');
    params.push(feedbackId);

    // Execute update
    await db.run(
      `UPDATE feedback SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Fetch updated feedback
    const updatedFeedback = await db.get<any>(
      'SELECT * FROM feedback WHERE id = ?',
      [feedbackId]
    );

    if (!updatedFeedback) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch updated feedback' },
        { status: 500 }
      );
    }

    // Transform to Feedback type
    const transformedFeedback: Feedback = {
      id: String(updatedFeedback.id),
      userId: updatedFeedback.user_id ? String(updatedFeedback.user_id) : null,
      category: updatedFeedback.category,
      title: updatedFeedback.title,
      description: updatedFeedback.description,
      url: updatedFeedback.url,
      screenshotUrl: updatedFeedback.screenshot_url,
      browserInfo: updatedFeedback.browser_info,
      status: updatedFeedback.status,
      priority: updatedFeedback.priority,
      createdAt: updatedFeedback.created_at,
      updatedAt: updatedFeedback.updated_at,
      resolvedAt: updatedFeedback.resolved_at,
    };

    return NextResponse.json({
      success: true,
      feedback: transformedFeedback,
    });
  } catch (error) {
    console.error('Error updating feedback:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update feedback'
      },
      { status: 500 }
    );
  }
}
