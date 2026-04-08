import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';

// POST /api/enrichment/dismiss - Dismiss an enrichment suggestion
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { suggestionId } = await req.json();

    if (!suggestionId) {
      return NextResponse.json({ error: 'suggestionId is required' }, { status: 400 });
    }

    // Verify suggestion exists
    const suggestion = await db.get<{ id: number }>(
      'SELECT id FROM enrichment_suggestions WHERE id = ?',
      [suggestionId]
    );

    if (!suggestion) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
    }

    // Insert dismissal (ignore if already dismissed)
    await db.run(
      'INSERT OR IGNORE INTO enrichment_dismissals (user_id, suggestion_id) VALUES (?, ?)',
      [user.id, suggestionId]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error dismissing enrichment suggestion:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
