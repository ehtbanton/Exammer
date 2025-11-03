import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { extractExamQuestions } from '@/ai/flows/extract-exam-questions';
import { matchPapersToMarkschemes } from '@/ai/flows/match-papers-to-markschemes';
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

    // Get paper and markscheme names from database
    const dbPapers = await db.all<{ name: string }>(
      'SELECT name FROM past_papers WHERE subject_id = ? ORDER BY id',
      [subjectId]
    );
    const dbMarkschemes = await db.all<{ name: string }>(
      'SELECT name FROM markschemes WHERE subject_id = ? ORDER BY id',
      [subjectId]
    );

    // Step 1: Match all papers to markschemes in ONE prompt
    let paperMarkschemeMap: Map<number, string | null> = new Map();

    if (markschemesDataUris.length > 0) {
      console.log(`[Batch Extraction] Step 1: Matching ${examPapersDataUris.length} papers to ${markschemesDataUris.length} markschemes in single prompt...`);

      const papersForMatching = examPapersDataUris.map((dataUri, index) => ({
        name: dbPapers[index]?.name || `paper-${index + 1}`,
        dataUri,
      }));

      const markschemesForMatching = markschemesDataUris.map((dataUri, index) => ({
        name: dbMarkschemes[index]?.name || `markscheme-${index + 1}`,
        dataUri,
      }));

      const matchingResult = await matchPapersToMarkschemes({
        papers: papersForMatching,
        markschemes: markschemesForMatching,
      });

      // Build map of paper index -> markscheme dataUri (or null)
      matchingResult.matches.forEach((match, paperIndex) => {
        if (match.markschemeName) {
          const markschemeIndex = markschemesForMatching.findIndex(m => m.name === match.markschemeName);
          if (markschemeIndex >= 0) {
            paperMarkschemeMap.set(paperIndex, markschemesDataUris[markschemeIndex]);
          } else {
            paperMarkschemeMap.set(paperIndex, null);
          }
        } else {
          paperMarkschemeMap.set(paperIndex, null);
        }
      });

      const matchedCount = Array.from(paperMarkschemeMap.values()).filter(v => v !== null).length;
      console.log(`[Batch Extraction] Matched ${matchedCount}/${examPapersDataUris.length} papers to markschemes`);
    } else {
      console.log(`[Batch Extraction] No markschemes provided, extracting questions without objectives`);
      examPapersDataUris.forEach((_, index) => paperMarkschemeMap.set(index, null));
    }

    // Step 2: Extract questions from each paper IN PARALLEL with its matched markscheme
    console.log(`[Batch Extraction] Step 2: Extracting questions from ${examPapersDataUris.length} papers in parallel...`);

    const topicsInfo = paperTypes.flatMap(pt =>
      pt.topics.map(t => ({ name: t.name, description: t.description }))
    );
    const paperTypesInfo = paperTypes.map(pt => ({ name: pt.name }));

    const allQuestionsResults = await Promise.all(
      examPapersDataUris.map((examPaperDataUri, index) => {
        const markschemeDataUri = paperMarkschemeMap.get(index);
        console.log(`[Batch Extraction] Extracting paper ${index + 1}/${examPapersDataUris.length}${markschemeDataUri ? ' (with markscheme)' : ' (no markscheme)'}`);
        return extractExamQuestions({
          examPaperDataUri,
          markschemeDataUri: markschemeDataUri || undefined,
          paperTypes: paperTypesInfo,
          topics: topicsInfo,
        });
      })
    );

    console.log(`[Batch Extraction] Extraction complete. Persisting to database...`);

    // Flatten all extracted questions
    const allExtractedQuestions: Array<{
      paperTypeName: string;
      questionText: string;
      summary: string;
      topicName: string;
      solutionObjectives?: string[];
    }> = [];

    allQuestionsResults.forEach(result => {
      result.questions.forEach(q => {
        allExtractedQuestions.push({
          paperTypeName: result.paperTypeName,
          questionText: q.questionText,
          summary: q.summary,
          topicName: q.topicName,
          solutionObjectives: q.solutionObjectives,
        });
      });
    });

    console.log(`[Batch Extraction] Total questions extracted: ${allExtractedQuestions.length}`);

    // Log sample of what AI returned for debugging
    if (allExtractedQuestions.length > 0) {
      const sample = allExtractedQuestions.slice(0, 3);
      console.log(`[Batch Extraction] Sample extracted questions:`);
      sample.forEach((q, i) => {
        console.log(`  ${i+1}. Paper: "${q.paperTypeName}" | Topic: "${q.topicName}" | Objectives: ${q.solutionObjectives?.length || 0}`);
        if (q.solutionObjectives && q.solutionObjectives.length > 0) {
          console.log(`      First objective: "${q.solutionObjectives[0]}"`);
        }
      });

      // Count how many questions have objectives
      const withObjectives = allExtractedQuestions.filter(q => q.solutionObjectives && q.solutionObjectives.length > 0).length;
      const withoutObjectives = allExtractedQuestions.length - withObjectives;
      console.log(`[Batch Extraction] Questions with objectives: ${withObjectives}, without: ${withoutObjectives}`);
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
          const questionsWithObjectivesCount = topicQuestions.filter(q => q.solutionObjectives && q.solutionObjectives.length > 0).length;
          console.log(`[Batch Extraction] Saving ${topicQuestions.length} questions for "${topic.name}" (${questionsWithObjectivesCount} with objectives)`);
        }

        for (const q of topicQuestions) {
          const solutionObjectivesJson = q.solutionObjectives ? JSON.stringify(q.solutionObjectives) : null;

          if (savedCount < 3 && solutionObjectivesJson) {
            console.log(`[Batch Extraction]   Saving question with ${q.solutionObjectives?.length} objectives: ${solutionObjectivesJson.substring(0, 100)}...`);
          }

          await db.run(
            'INSERT INTO questions (topic_id, question_text, summary, solution_objectives) VALUES (?, ?, ?, ?)',
            [topic.id, q.questionText, q.summary, solutionObjectivesJson]
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
