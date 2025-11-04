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

    // Get paper and markscheme names from database
    const dbPapers = await db.all<{ name: string }>(
      'SELECT name FROM past_papers WHERE subject_id = ? ORDER BY id',
      [subjectId]
    );
    const dbMarkschemes = await db.all<{ name: string }>(
      'SELECT name FROM markschemes WHERE subject_id = ? ORDER BY id',
      [subjectId]
    );

    // Step 1: Match papers to markschemes using filename similarity
    let paperMarkschemeMap: Map<number, string | null> = new Map();

    if (markschemesDataUris.length > 0) {
      console.log(`[Batch Extraction] Step 1: Matching ${examPapersDataUris.length} papers to ${markschemesDataUris.length} markschemes using filename similarity...`);

      // Helper function to normalize filenames for matching
      const normalizeFilename = (filename: string): string => {
        return filename
          .toLowerCase()
          .replace(/[_\s-]+/g, '') // Remove separators
          .replace(/\.(pdf|docx?|png|jpe?g)$/i, '') // Remove extensions
          .replace(/markscheme|ms|solutions?|answers?/gi, '') // Remove common markscheme indicators
          .trim();
      };

      // Helper function to calculate similarity between two strings
      const similarity = (s1: string, s2: string): number => {
        const longer = s1.length > s2.length ? s1 : s2;
        const shorter = s1.length > s2.length ? s2 : s1;

        if (longer.length === 0) return 1.0;

        // Count matching characters
        let matches = 0;
        for (let i = 0; i < shorter.length; i++) {
          if (longer.includes(shorter[i])) matches++;
        }

        return matches / longer.length;
      };

      // Match each paper to the most similar markscheme
      for (let paperIndex = 0; paperIndex < examPapersDataUris.length; paperIndex++) {
        const paperName = dbPapers[paperIndex]?.name || `paper-${paperIndex + 1}`;
        const normalizedPaperName = normalizeFilename(paperName);

        let bestMatch: { index: number; score: number } | null = null;

        for (let msIndex = 0; msIndex < markschemesDataUris.length; msIndex++) {
          const msName = dbMarkschemes[msIndex]?.name || `markscheme-${msIndex + 1}`;
          const normalizedMsName = normalizeFilename(msName);

          const score = similarity(normalizedPaperName, normalizedMsName);

          // Consider it a match if similarity is above 60%
          if (score > 0.6 && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { index: msIndex, score };
          }
        }

        if (bestMatch && bestMatch.score > 0.6) {
          paperMarkschemeMap.set(paperIndex, markschemesDataUris[bestMatch.index]);
          console.log(`[Batch Extraction]   Matched "${paperName}" → "${dbMarkschemes[bestMatch.index]?.name}" (${(bestMatch.score * 100).toFixed(0)}% similar)`);
        } else {
          paperMarkschemeMap.set(paperIndex, null);
          console.log(`[Batch Extraction]   No match for "${paperName}"`);
        }
      }

      const matchedCount = Array.from(paperMarkschemeMap.values()).filter(v => v !== null).length;
      console.log(`[Batch Extraction] Matched ${matchedCount}/${examPapersDataUris.length} papers to markschemes`);

      // Filter out papers without markschemes
      const papersToDiscard: string[] = [];
      Array.from(paperMarkschemeMap.entries()).forEach(([paperIndex, markschemeDataUri]) => {
        if (markschemeDataUri === null) {
          const paperName = dbPapers[paperIndex]?.name || `paper-${paperIndex + 1}`;
          papersToDiscard.push(paperName);
        }
      });

      if (papersToDiscard.length > 0) {
        console.log(`[Batch Extraction] Discarding ${papersToDiscard.length} paper(s) without matching markschemes:`);
        papersToDiscard.forEach(name => console.log(`  - ${name}`));
      }

      // Identify unused markschemes
      const usedMarkschemeIndices = new Set<number>();
      Array.from(paperMarkschemeMap.entries()).forEach(([paperIndex, markschemeDataUri]) => {
        if (markschemeDataUri !== null) {
          const msIndex = markschemesDataUris.indexOf(markschemeDataUri);
          if (msIndex !== -1) {
            usedMarkschemeIndices.add(msIndex);
          }
        }
      });

      const unusedMarkschemes: string[] = [];
      markschemesDataUris.forEach((_, msIndex) => {
        if (!usedMarkschemeIndices.has(msIndex)) {
          const msName = dbMarkschemes[msIndex]?.name || `markscheme-${msIndex + 1}`;
          unusedMarkschemes.push(msName);
        }
      });

      if (unusedMarkschemes.length > 0) {
        console.log(`[Batch Extraction] Found ${unusedMarkschemes.length} unused markscheme(s) without matching papers:`);
        unusedMarkschemes.forEach(name => console.log(`  - ${name}`));
      }
    } else {
      console.log(`[Batch Extraction] No markschemes provided, discarding all papers as per configuration`);
      // Discard all papers if no markschemes provided
      examPapersDataUris.forEach((_, index) => paperMarkschemeMap.set(index, null));
    }

    // Filter to only keep papers with matching markschemes
    const filteredPaperData: Array<{ index: number; dataUri: string; markschemeDataUri: string; name: string }> = [];
    Array.from(paperMarkschemeMap.entries()).forEach(([paperIndex, markschemeDataUri]) => {
      if (markschemeDataUri !== null) {
        filteredPaperData.push({
          index: paperIndex,
          dataUri: examPapersDataUris[paperIndex],
          markschemeDataUri,
          name: dbPapers[paperIndex]?.name || `paper-${paperIndex + 1}`
        });
      }
    });

    if (filteredPaperData.length === 0) {
      console.log(`[Batch Extraction] No papers with matching markschemes to process. Exiting.`);
      return NextResponse.json({
        success: true,
        papersProcessed: 0,
        papersFailed: 0,
        failedPapers: [],
        questionsExtracted: 0,
        questionsSaved: 0,
        message: 'No papers with matching markschemes to process'
      });
    }

    // Step 2: Extract questions from each paper IN PARALLEL with its matched markscheme
    // Use Promise.allSettled to handle individual failures gracefully
    console.log(`[Batch Extraction] Step 2: Extracting questions from ${filteredPaperData.length} papers (with markschemes) in parallel...`);

    const topicsInfo = paperTypes.flatMap(pt =>
      pt.topics.map(t => ({ name: t.name, description: t.description }))
    );
    const paperTypesInfo = paperTypes.map(pt => ({ name: pt.name }));

    // Helper function to save questions for a single paper immediately
    const saveQuestionsForPaper = async (result: any, paperIndex: number) => {
      let paperSavedCount = 0;

      // paperTypeName is at the result level, not per-question
      const paperTypeName = result.paperTypeName;

      if (!paperTypeName) {
        console.warn(`[Batch Extraction] Paper ${paperIndex + 1} has no paperTypeName, skipping all questions`);
        return 0;
      }

      for (const question of result.questions) {
        // Validate question has required fields
        if (!question.topicName) {
          console.warn(`[Batch Extraction] Skipping question with missing topicName:`, {
            summary: question.summary
          });
          continue;
        }

        // Find matching topic
        let questionSaved = false;
        for (const pt of paperTypes) {
          for (const topic of pt.topics) {
            // Use paperTypeName from result level
            const matchesPaperType = paperTypeName === pt.name ||
                                     pt.name.includes(paperTypeName) ||
                                     paperTypeName.includes(pt.name);

            const matchesTopic = topic.name.toLowerCase().includes(question.topicName.toLowerCase()) ||
                                question.topicName.toLowerCase().includes(topic.name.toLowerCase());

            if (matchesPaperType && matchesTopic) {
              const solutionObjectivesJson = question.solutionObjectives ? JSON.stringify(question.solutionObjectives) : null;

              await db.run(
                'INSERT INTO questions (topic_id, question_text, summary, solution_objectives) VALUES (?, ?, ?, ?)',
                [topic.id, question.questionText, question.summary, solutionObjectivesJson]
              );
              paperSavedCount++;
              questionSaved = true;
              break; // Question saved, move to next question
            }
          }
          if (questionSaved) break;
        }
      }

      return paperSavedCount;
    };

    // Process papers in parallel, handling failures gracefully
    const extractionPromises = filteredPaperData.map(async (paperData, arrayIndex) => {
      const { index: originalIndex, dataUri: examPaperDataUri, markschemeDataUri, name: paperName } = paperData;

      console.log(`[Batch Extraction] Extracting paper ${arrayIndex + 1}/${filteredPaperData.length}: "${paperName}" (with markscheme)`);

      try {
        const result = await extractExamQuestions({
          examPaperDataUri,
          markschemeDataUri,
          paperTypes: paperTypesInfo,
          topics: topicsInfo,
        });

        console.log(`[Batch Extraction] ✓ Paper ${arrayIndex + 1} extracted: ${result.questions.length} questions`);

        // Save questions immediately to database
        const savedCount = await saveQuestionsForPaper(result, originalIndex);
        console.log(`[Batch Extraction] ✓ Paper ${arrayIndex + 1} saved: ${savedCount} questions persisted to database`);

        return {
          status: 'success' as const,
          paperIndex: originalIndex,
          paperName,
          questionsExtracted: result.questions.length,
          questionsSaved: savedCount
        };
      } catch (error: any) {
        console.error(`[Batch Extraction] ✗ Paper ${arrayIndex + 1} failed: ${error.message}`);
        if (error.message?.includes('Generation blocked')) {
          console.error(`[Batch Extraction]   Reason: Gemini safety filter blocked content in "${paperName}"`);
        }
        return {
          status: 'failed' as const,
          paperIndex: originalIndex,
          paperName,
          error: error.message
        };
      }
    });

    const results = await Promise.allSettled(extractionPromises);

    // Summarize results
    let totalSuccessful = 0;
    let totalFailed = 0;
    let totalQuestionsExtracted = 0;
    let totalQuestionsSaved = 0;
    const failedPapers: string[] = [];

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const paperResult = result.value;
        if (paperResult.status === 'success') {
          totalSuccessful++;
          totalQuestionsExtracted += paperResult.questionsExtracted;
          totalQuestionsSaved += paperResult.questionsSaved;
        } else {
          totalFailed++;
          failedPapers.push(`${paperResult.paperName}: ${paperResult.error}`);
        }
      } else {
        totalFailed++;
        failedPapers.push(`Unknown paper: ${result.reason}`);
      }
    });

    console.log(`\n[Batch Extraction] ========== SUMMARY ==========`);
    console.log(`[Batch Extraction] Successful: ${totalSuccessful}/${filteredPaperData.length} papers`);
    console.log(`[Batch Extraction] Failed: ${totalFailed}/${filteredPaperData.length} papers`);
    console.log(`[Batch Extraction] Total questions extracted: ${totalQuestionsExtracted}`);
    console.log(`[Batch Extraction] Total questions saved: ${totalQuestionsSaved}`);

    if (failedPapers.length > 0) {
      console.log(`[Batch Extraction] Failed papers:`);
      failedPapers.forEach(fp => console.log(`  - ${fp}`));
    }
    console.log(`[Batch Extraction] ================================\n`);

    return NextResponse.json({
      success: totalFailed === 0,
      papersProcessed: totalSuccessful,
      papersFailed: totalFailed,
      failedPapers: failedPapers,
      questionsExtracted: totalQuestionsExtracted,
      questionsSaved: totalQuestionsSaved
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
