import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, getUserWithAccessLevel } from '@/lib/auth-helpers';
import type {
  CreateFeedbackRequest,
  CreateFeedbackResponse,
  Feedback,
  FeedbackWithDetails,
} from '@/lib/types';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schema for feedback submission
const createFeedbackSchema = z.object({
  category: z.enum(['bug', 'feature', 'improvement', 'question', 'other']),
  title: z.string().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters'),
  description: z.string().min(1, 'Description is required').max(5000, 'Description cannot exceed 5000 characters'),
  url: z.string().url().optional().or(z.literal('')),
  screenshotUrl: z.string().optional(),
  browserInfo: z.string().optional(),
});

// POST /api/feedback - Submit feedback (authenticated or anonymous)
export async function POST(req: NextRequest): Promise<NextResponse<CreateFeedbackResponse>> {
  try {
    // Get current user (optional - feedback can be submitted by anonymous users)
    const user = await getCurrentUser();
    const userId = user?.id || null;

    // Parse and validate request body
    const body = await req.json();
    const validation = createFeedbackSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors[0].message
        },
        { status: 400 }
      );
    }

    const { category, title, description, url, screenshotUrl, browserInfo } = validation.data;

    // Get current URL from request if not provided
    const feedbackUrl = url || req.headers.get('referer') || undefined;

    // Insert feedback into database
    const result = await db.run<{ lastID: number }>(
      `INSERT INTO feedback (
        user_id, category, title, description, url, screenshot_url, browser_info, status, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'new', 'medium')`,
      [userId, category, title, description, feedbackUrl, screenshotUrl, browserInfo]
    );

    const feedbackId = result.lastID;

    // Create initial status history entry
    await db.run(
      `INSERT INTO feedback_status_history (feedback_id, new_status)
       VALUES (?, 'new')`,
      [feedbackId]
    );

    // Fetch the created feedback
    const feedback = await db.get<any>(
      'SELECT * FROM feedback WHERE id = ?',
      [feedbackId]
    );

    if (!feedback) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch feedback after creation' },
        { status: 500 }
      );
    }

    // Transform to Feedback type
    const transformedFeedback: Feedback = {
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
    };

    return NextResponse.json({
      success: true,
      feedback: transformedFeedback,
    });
  } catch (error) {
    console.error('Error creating feedback:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create feedback'
      },
      { status: 500 }
    );
  }
}

// GET /api/feedback - List feedback (admin only, or user's own feedback)
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get full user data including access level
    const fullUser = await getUserWithAccessLevel(user.id);
    const isAdmin = fullUser?.access_level === 3;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const priority = searchParams.get('priority');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = `
      SELECT
        f.*,
        u.name as user_name,
        u.email as user_email
      FROM feedback f
      LEFT JOIN users u ON f.user_id = u.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (!isAdmin) {
      // Regular users can only see their own feedback
      conditions.push('f.user_id = ?');
      params.push(user.id);
    }

    if (status) {
      conditions.push('f.status = ?');
      params.push(status);
    }

    if (category) {
      conditions.push('f.category = ?');
      params.push(category);
    }

    if (priority) {
      conditions.push('f.priority = ?');
      params.push(priority);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY f.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const feedbackList = await db.all<any>(query, params);

    // Transform to FeedbackWithDetails type
    const transformedFeedback: FeedbackWithDetails[] = feedbackList.map((f: any) => ({
      id: String(f.id),
      userId: f.user_id ? String(f.user_id) : null,
      category: f.category,
      title: f.title,
      description: f.description,
      url: f.url,
      screenshotUrl: f.screenshot_url,
      browserInfo: f.browser_info,
      status: f.status,
      priority: f.priority,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
      resolvedAt: f.resolved_at,
      userName: f.user_name,
      userEmail: f.user_email,
    }));

    return NextResponse.json(transformedFeedback);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    );
  }
}
