import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { extractExamQuestions } from '@/ai/flows/extract-exam-questions';
import { db } from '@/lib/db';

export const maxDuration = 300; // 5 minutes max for batch processing
export const dynamic = 'force-dynamic';

interface ExtractQuestionsRequest {
  subjectId: string;
  examPapersDataUris: string[];
  markschemesDataUris: string[];
  paperTypes: Array<{ id: string; name: string; topics: Array<{ id: string; name: string; description: string }> }>;
}

/**
 * POST /api/extract-questions-batch
 *
 * Processes multiple exam papers in parallel using the API key manager.
 * This endpoint runs on the server side where the singleton is truly shared,
 * enabling parallel processing with different API keys.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { subjectId, examPapersDataUris, markschemesDataUris = [], paperTypes } = await req.json() as ExtractQuestionsRequest;

    // Verify user has access to this subject
    const workspace = await db.get<{ is_creator: number }>(
      'SELECT is_creator FROM user_workspaces WHERE user_id = ? AND subject_id = ?',
      [user.id, subjectId]
    );

    if (!workspace) {
      return NextResponse.json({ error: 'Subject not found in workspace' }, { status: 404 });
    }

    if (workspace.is_creator !== 1) {
      return NextResponse.json({ error: 'Only creators can add questions' }, { status: 403 });
    }

    console.log(`[Batch Extraction] Processing ${examPapersDataUris.length} papers with ${markschemesDataUris.length} markschemes for subject ${subjectId}`);

    // Get markscheme names from database to include with data URIs
    const dbMarkschemes = await db.all<{ name: string, content: string }>(
      'SELECT name, content FROM markschemes WHERE subject_id = ?',
      [subjectId]
    );

    // Format markschemes for AI (match data URIs with names)
    const markschemesForAI = markschemesDataUris.map((dataUri, index) => {
      // Try to match by index, or use a generic name
      const name = dbMarkschemes[index]?.name || `markscheme-${index + 1}`;
      return { name, dataUri };
    });

    // Extract topics info for AI
    const topicsInfo = paperTypes.flatMap(pt =>
      pt.topics.map(t => ({ name: t.name, description: t.description }))
    );
    const paperTypesInfo = paperTypes.map(pt => ({ name: pt.name }));

    // Process all exam papers in parallel
    const allQuestionsResults = await Promise.all(
      examPapersDataUris.map((examPaperDataUri, index) => {
        console.log(`[Batch Extraction] Extracting paper ${index + 1}/${examPapersDataUris.length}`);
        return extractExamQuestions({
          examPaperDataUri,
          markschemes: markschemesForAI,
          paperTypes: paperTypesInfo,
          topics: topicsInfo,
        });
      })
    );

    console.log(`[Batch Extraction] Extraction complete. Persisting to database...`);

    // Log papers without markschemes
    const papersWithoutMarkschemes = allQuestionsResults.filter(r => !r.matchedMarkschemeName);
    if (papersWithoutMarkschemes.length > 0) {
      console.log(`[Batch Extraction] WARNING: ${papersWithoutMarkschemes.length} paper(s) skipped due to missing markschemes`);
    }

    // Flatten all extracted questions (only from papers with markschemes)
    const allExtractedQuestions: Array<{
      paperTypeName: string;
      questionText: string;
      summary: string;
      topicName: string;
      solutionObjectives: string[];
      matchedMarkschemeName: string;
    }> = [];

    allQuestionsResults.forEach(result => {
      if (result.matchedMarkschemeName) {
        result.questions.forEach(q => {
          allExtractedQuestions.push({
            paperTypeName: result.paperTypeName,
            questionText: q.questionText,
            summary: q.summary,
            topicName: q.topicName,
            solutionObjectives: q.solutionObjectives,
            matchedMarkschemeName: result.matchedMarkschemeName,
          });
        });
      }
    });

    console.log(`[Batch Extraction] Total questions (with markschemes): ${allExtractedQuestions.length}`);

    // Log sample of what AI returned for debugging
    if (allExtractedQuestions.length > 0) {
      const sample = allExtractedQuestions.slice(0, 3);
      console.log(`[Batch Extraction] Sample extracted questions:`);
      sample.forEach((q, i) => {
        console.log(`  ${i+1}. Paper: "${q.paperTypeName}" | Topic: "${q.topicName}" | Objectives: ${q.solutionObjectives.length}`);
      });
    }

    // Persist questions to database
    let savedCount = 0;
    for (const pt of paperTypes) {
      for (const topic of pt.topics) {
        // Match questions by checking if the AI's topic name is contained in the database topic name
        // This handles cases where DB has "b202: Engineering Ethics" but AI returns "Engineering Ethics"
        const topicQuestions = allExtractedQuestions.filter(q => {
          const matchesPaperType = q.paperTypeName === pt.name ||
                                   pt.name.includes(q.paperTypeName) ||
                                   q.paperTypeName.includes(pt.name);

          const matchesTopic = topic.name.toLowerCase().includes(q.topicName.toLowerCase()) ||
                              q.topicName.toLowerCase().includes(topic.name.toLowerCase());

          return matchesPaperType && matchesTopic;
        });

        if (topicQuestions.length > 0) {
          console.log(`[Batch Extraction] Saving ${topicQuestions.length} questions for "${topic.name}"`);
        }

        for (const q of topicQuestions) {
          // Find markscheme_id from database
          const markscheme = await db.get<{ id: number }>(
            'SELECT id FROM markschemes WHERE subject_id = ? AND name = ?',
            [subjectId, q.matchedMarkschemeName]
          );

          const solutionObjectivesJson = JSON.stringify(q.solutionObjectives);

          await db.run(
            'INSERT INTO questions (topic_id, question_text, summary, solution_objectives, markscheme_id) VALUES (?, ?, ?, ?, ?)',
            [topic.id, q.questionText, q.summary, solutionObjectivesJson, markscheme?.id || null]
          );
          savedCount++;
        }
      }
    }

    console.log(`[Batch Extraction] Successfully saved ${savedCount} questions to database`);

    return NextResponse.json({
      success: true,
      questionsExtracted: allExtractedQuestions.length,
      questionsSaved: savedCount
    });

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[Batch Extraction] ERROR:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
