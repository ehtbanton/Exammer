import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import { classifySubjectField } from '@/ai/flows/classify-subject-field';
import { compareCurriculaGaps } from '@/ai/flows/compare-curricula-gaps';
import { detectFieldBreakthroughs } from '@/ai/flows/detect-field-breakthroughs';

interface FieldClassification {
  field: string;
  subfield: string;
  level: string;
  keywords: string[];
}

interface TopicRow {
  name: string;
  description: string;
}

// POST /api/enrichment/refresh - Run enrichment pipeline for a subject
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { subjectId } = await req.json();

    if (!subjectId) {
      return NextResponse.json({ error: 'subjectId is required' }, { status: 400 });
    }

    // Verify user has access to this subject
    const subject = await db.get<{
      id: number;
      name: string;
      field_classification: string | null;
      syllabus_content: string | null;
    }>(
      `SELECT s.id, s.name, s.field_classification, s.syllabus_content
       FROM subjects s
       LEFT JOIN user_workspaces uw ON s.id = uw.subject_id AND uw.user_id = ?
       LEFT JOIN class_subjects cs ON s.id = cs.subject_id
       LEFT JOIN class_memberships cm ON cs.class_id = cm.class_id AND cm.user_id = ? AND cm.status = 'approved'
       WHERE s.id = ? AND (uw.id IS NOT NULL OR cm.id IS NOT NULL)`,
      [user.id, user.id, subjectId]
    );

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found or no access' }, { status: 404 });
    }

    // Get topic names for this subject
    const topics = await db.all<TopicRow>(
      `SELECT t.name, COALESCE(t.description, '') as description
       FROM topics t
       JOIN paper_types pt ON t.paper_type_id = pt.id
       WHERE pt.subject_id = ?`,
      [subjectId]
    );

    const topicNames = topics.map(t => t.name);

    if (topicNames.length === 0) {
      return NextResponse.json({ error: 'Subject has no topics yet' }, { status: 400 });
    }

    // Step 1: Classify subject field if not already classified
    let classification: FieldClassification;

    if (subject.field_classification) {
      classification = JSON.parse(subject.field_classification);
    } else {
      console.log(`[Enrichment] Classifying subject ${subjectId}: ${subject.name}`);
      classification = await classifySubjectField({
        subjectName: subject.name,
        topicNames,
        syllabusExcerpt: subject.syllabus_content?.substring(0, 2000),
      });

      await db.run(
        'UPDATE subjects SET field_classification = ? WHERE id = ?',
        [JSON.stringify(classification), subjectId]
      );
    }

    // Step 2: Find similar subjects on the platform
    const allSubjects = await db.all<{
      id: number;
      name: string;
      field_classification: string;
    }>(
      `SELECT id, name, field_classification FROM subjects
       WHERE id != ? AND field_classification IS NOT NULL`,
      [subjectId]
    );

    const similarSubjects = allSubjects.filter(s => {
      try {
        const otherClassification: FieldClassification = JSON.parse(s.field_classification);
        return otherClassification.field.toLowerCase() === classification.field.toLowerCase();
      } catch {
        return false;
      }
    });

    let newSuggestionsCount = 0;

    if (similarSubjects.length > 0) {
      // Step 3A: Cross-curriculum gap detection
      console.log(`[Enrichment] Found ${similarSubjects.length} similar subjects for comparison`);

      // Delete old gap suggestions for this subject to refresh
      await db.run(
        "DELETE FROM enrichment_suggestions WHERE subject_id = ? AND type = 'gap'",
        [subjectId]
      );

      for (const similar of similarSubjects) {
        // Load topics for the similar subject
        const similarTopics = await db.all<TopicRow>(
          `SELECT t.name, COALESCE(t.description, '') as description
           FROM topics t
           JOIN paper_types pt ON t.paper_type_id = pt.id
           WHERE pt.subject_id = ?`,
          [similar.id]
        );

        if (similarTopics.length === 0) continue;

        const gapResult = await compareCurriculaGaps({
          subjectA: {
            name: similar.name,
            topics: similarTopics.map(t => ({ name: t.name, description: t.description })),
          },
          subjectB: {
            name: subject.name,
            topics: topics.map(t => ({ name: t.name, description: t.description })),
          },
        });

        // Insert gaps found in subject B (our subject) - topics in A but not in B
        for (const gap of gapResult.gapsInB) {
          if (gap.confidenceScore < 40) continue; // Skip low-confidence gaps

          await db.run(
            `INSERT INTO enrichment_suggestions
             (subject_id, type, source_subject_id, source_topic_name, source_topic_description, field, confidence_score)
             VALUES (?, 'gap', ?, ?, ?, ?, ?)`,
            [subjectId, similar.id, gap.topicName, `${gap.topicDescription} — ${gap.relevanceReason}`, classification.field, gap.confidenceScore]
          );
          newSuggestionsCount++;
        }

        // Also insert gaps found in subject A (the similar subject) - topics in B but not in A
        for (const gap of gapResult.gapsInA) {
          if (gap.confidenceScore < 40) continue;

          await db.run(
            `INSERT INTO enrichment_suggestions
             (subject_id, type, source_subject_id, source_topic_name, source_topic_description, field, confidence_score)
             VALUES (?, 'gap', ?, ?, ?, ?, ?)`,
            [similar.id, subjectId, gap.topicName, `${gap.topicDescription} — ${gap.relevanceReason}`, classification.field, gap.confidenceScore]
          );
        }
      }
    } else {
      // Step 3B: No similar subjects - fall back to breakthrough detection
      console.log(`[Enrichment] No similar subjects found, detecting breakthroughs for ${classification.field}`);

      // Delete expired breakthroughs
      await db.run(
        "DELETE FROM enrichment_suggestions WHERE subject_id = ? AND type = 'breakthrough' AND expires_at IS NOT NULL AND expires_at < unixepoch()",
        [subjectId]
      );

      // Check if we already have non-expired breakthroughs
      const existingBreakthroughs = await db.get<{ count: number }>(
        "SELECT COUNT(*) as count FROM enrichment_suggestions WHERE subject_id = ? AND type = 'breakthrough' AND (expires_at IS NULL OR expires_at > unixepoch())",
        [subjectId]
      );

      if (!existingBreakthroughs || existingBreakthroughs.count === 0) {
        const breakthroughResult = await detectFieldBreakthroughs({
          field: classification.field,
          subfield: classification.subfield,
          level: classification.level,
          topicNames,
        });

        const thirtyDaysFromNow = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);

        for (const bt of breakthroughResult.breakthroughs) {
          await db.run(
            `INSERT INTO enrichment_suggestions
             (subject_id, type, breakthrough_title, breakthrough_summary, breakthrough_source, breakthrough_relevance, field, confidence_score, expires_at)
             VALUES (?, 'breakthrough', ?, ?, ?, ?, ?, ?, ?)`,
            [subjectId, bt.title, bt.summary, bt.source, bt.relevance, classification.field, bt.employabilityImpact === 'high' ? 90 : bt.employabilityImpact === 'medium' ? 70 : 50, thirtyDaysFromNow]
          );
          newSuggestionsCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      newSuggestionsCount,
      enrichmentType: similarSubjects.length > 0 ? 'gap' : 'breakthrough',
      similarSubjectsFound: similarSubjects.length,
      field: classification.field,
      subfield: classification.subfield,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error refreshing enrichment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
