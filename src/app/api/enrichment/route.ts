import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import type { EnrichmentSuggestion } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/enrichment?subjectId=X - Get enrichment suggestions for a subject
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const subjectId = searchParams.get('subjectId');

    if (!subjectId) {
      return NextResponse.json({ error: 'subjectId is required' }, { status: 400 });
    }

    // Verify user has access to this subject (via workspace or class)
    const hasAccess = await db.get<{ id: number }>(
      `SELECT s.id FROM subjects s
       LEFT JOIN user_workspaces uw ON s.id = uw.subject_id AND uw.user_id = ?
       LEFT JOIN class_subjects cs ON s.id = cs.subject_id
       LEFT JOIN class_memberships cm ON cs.class_id = cm.class_id AND cm.user_id = ? AND cm.status = 'approved'
       WHERE s.id = ? AND (uw.id IS NOT NULL OR cm.id IS NOT NULL)`,
      [user.id, user.id, subjectId]
    );

    if (!hasAccess) {
      return NextResponse.json({ error: 'Subject not found or no access' }, { status: 404 });
    }

    // Get suggestions not dismissed by this user, not expired
    const suggestions = await db.all<EnrichmentSuggestion>(
      `SELECT es.* FROM enrichment_suggestions es
       WHERE es.subject_id = ?
       AND es.id NOT IN (
         SELECT suggestion_id FROM enrichment_dismissals WHERE user_id = ?
       )
       AND (es.expires_at IS NULL OR es.expires_at > unixepoch())
       ORDER BY es.confidence_score DESC, es.created_at DESC`,
      [subjectId, user.id]
    );

    // Get source subject names for gap suggestions
    const gaps = [];
    const breakthroughs = [];

    for (const s of suggestions) {
      if (s.type === 'gap') {
        let sourceSubjectName = 'Unknown';
        if (s.source_subject_id) {
          const source = await db.get<{ name: string }>(
            'SELECT name FROM subjects WHERE id = ?',
            [s.source_subject_id]
          );
          sourceSubjectName = source?.name ?? 'Unknown';
        }
        gaps.push({
          id: s.id,
          sourceSubjectName,
          sourceSubjectId: s.source_subject_id,
          topicName: s.source_topic_name,
          topicDescription: s.source_topic_description,
          field: s.field,
          confidenceScore: s.confidence_score,
          createdAt: s.created_at,
        });
      } else {
        breakthroughs.push({
          id: s.id,
          title: s.breakthrough_title,
          summary: s.breakthrough_summary,
          source: s.breakthrough_source,
          relevance: s.breakthrough_relevance,
          field: s.field,
          confidenceScore: s.confidence_score,
          createdAt: s.created_at,
          expiresAt: s.expires_at,
        });
      }
    }

    const enrichmentType = gaps.length > 0 ? 'gap' : breakthroughs.length > 0 ? 'breakthrough' : 'none';

    return NextResponse.json({ gaps, breakthroughs, enrichmentType });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching enrichment suggestions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
