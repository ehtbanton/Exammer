import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { extractMarkschemesSolutions } from '@/ai/flows/extract-markscheme-solutions';
import { db } from '@/lib/db';

export const maxDuration = 300; // 5 minutes max for batch processing
export const dynamic = 'force-dynamic';

interface MatchMarkschemesRequest {
  subjectId: string;
  markschemesDataUris: string[];
  paperTypes: Array<{ id: string; name: string; topics: Array<{ id: string; name: string; description: string }> }>;
}

/**
 * POST /api/match-markschemes
 *
 * Process M: Processes markschemes and matches them to existing questions in the database
 * 1. Extracts solutions from markschemes
 * 2. Matches solutions to existing questions based on paper_date and question_number
 * 3. Updates questions with solution_objectives
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { subjectId, markschemesDataUris, paperTypes } = await req.json() as MatchMarkschemesRequest;

    // Verify user has access to this subject
    const workspace = await db.get<{ is_creator: number }>(
      'SELECT is_creator FROM user_workspaces WHERE user_id = ? AND subject_id = ?',
      [user.id, subjectId]
    );

    if (!workspace) {
      return NextResponse.json({ error: 'Subject not found in workspace' }, { status: 404 });
    }

    if (workspace.is_creator !== 1) {
      return NextResponse.json({ error: 'Only creators can add markschemes' }, { status: 403 });
    }

    console.log(`[Process M] Processing ${markschemesDataUris.length} markschemes for subject ${subjectId}`);

    // Get markscheme names from database for logging
    const dbMarkschemes = await db.all<{ name: string }>(
      'SELECT name FROM markschemes WHERE subject_id = ? ORDER BY id DESC LIMIT ?',
      [subjectId, markschemesDataUris.length]
    );

    // Prepare data for AI flows
    const paperTypesInfo = paperTypes.map(pt => ({ name: pt.name }));

    // Step 1: Extract solutions from markschemes (parallel)
    console.log(`[Process M] Step 1: Extracting solutions from ${markschemesDataUris.length} markschemes...`);

    const markschemeExtractionPromises = markschemesDataUris.map(async (markschemeDataUri, index) => {
      const msName = dbMarkschemes[dbMarkschemes.length - 1 - index]?.name || `markscheme-${index + 1}`;
      console.log(`[Process M] Processing markscheme ${index + 1}/${markschemesDataUris.length}: "${msName}"`);

      try {
        const result = await extractMarkschemesSolutions({
          markschemeDataUri,
          paperTypes: paperTypesInfo,
        });

        const monthPadded = result.month.toString().padStart(2, '0');
        console.log(`[Process M] ✓ Markscheme ${index + 1} extracted: "${msName}" → Paper: ${result.year}-${monthPadded} "${result.paperTypeName}", Solutions: ${result.solutions.length}`);

        return {
          status: 'success' as const,
          index,
          msName,
          data: result
        };
      } catch (error: any) {
        console.error(`[Process M] ✗ Markscheme ${index + 1} failed: ${error.message}`);
        return {
          status: 'failed' as const,
          index,
          msName,
          error: error.message
        };
      }
    });

    const markschemeResults = await Promise.allSettled(markschemeExtractionPromises);

    console.log(`[Process M] Step 1 completed: ${markschemeResults.length} markschemes processed`);

    // Extract successful results
    const successfulMarkschemes = markschemeResults
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value.status === 'success')
      .map(r => r.value);

    console.log(`[Process M] Successful extractions: ${successfulMarkschemes.length} markschemes`);

    // Step 2: Match solutions to existing questions
    console.log(`\n[Process M] Step 2: Matching solutions to existing questions...`);

    // Fetch all existing questions from database
    const existingQuestions = await db.all<{
      id: number;
      paper_date: string | null;
      question_number: string | null;
      solution_objectives: string | null;
    }>(
      `SELECT q.id, q.paper_date, q.question_number, q.solution_objectives
       FROM questions q
       INNER JOIN topics t ON q.topic_id = t.id
       INNER JOIN paper_types pt ON t.paper_type_id = pt.id
       WHERE pt.subject_id = ?`,
      [subjectId]
    );

    console.log(`[Process M] Found ${existingQuestions.length} existing questions in database`);

    let questionsMatched = 0;
    let questionsUpdated = 0;
    const unmatchedSolutions: any[] = [];

    // For each markscheme, fuzzy match paper type and process solutions
    for (const msResult of successfulMarkschemes) {
      const { msName, data: msData } = msResult;

      // Fuzzy match paper type name for markscheme
      const aiPaperTypeName = msData.paperTypeName || '';
      if (!aiPaperTypeName.trim()) {
        console.warn(`[Process M] ✗ Markscheme "${msName}" missing paper type name, skipping`);
        continue;
      }

      let matchedPaperType = null;
      let paperTypeIndex = -1;

      for (let i = 0; i < paperTypes.length; i++) {
        const dbPaperType = paperTypes[i];
        const dbPaperTypeLower = dbPaperType.name.toLowerCase();
        const aiPaperTypeLower = aiPaperTypeName.toLowerCase();

        // Bidirectional substring matching
        const dbContainsAi = dbPaperTypeLower.includes(aiPaperTypeLower);
        const aiContainsDb = aiPaperTypeLower.includes(dbPaperTypeLower);

        if (dbContainsAi || aiContainsDb) {
          matchedPaperType = dbPaperType;
          paperTypeIndex = i;
          console.log(`[Process M] ✓ Fuzzy matched paper type: AI="${aiPaperTypeName}" → DB="${dbPaperType.name}" (index ${paperTypeIndex})`);
          break;
        }
      }

      if (!matchedPaperType || paperTypeIndex === -1) {
        console.warn(`[Process M] ✗ Markscheme "${msName}" paper type "${aiPaperTypeName}" could not be matched, skipping`);
        continue;
      }

      // Construct paper identifier for this markscheme
      const monthPadded = msData.month.toString().padStart(2, '0');
      const paperDate = `${msData.year}-${monthPadded}`; // YYYY-MM

      // Process each solution
      for (const solution of msData.solutions) {
        const questionNumber = solution.questionNumber;
        if (typeof questionNumber !== 'number' || questionNumber < 1) {
          console.warn(`[Process M] ✗ Markscheme "${msName}" has solution with invalid questionNumber: ${questionNumber}, skipping`);
          continue;
        }

        const questionNumberStr = `${paperTypeIndex}-${questionNumber}`; // P-Q
        const solutionKey = `${paperDate}-${paperTypeIndex}-${questionNumber}`; // YYYY-MM-P-Q

        // Try to find matching question(s) - there may be multiple questions with same paper_date and base question number
        // (e.g., one question for each topic in a multi-topic question)
        const matchingQuestions = existingQuestions.filter(q => {
          if (!q.paper_date || !q.question_number) return false;

          // Check if paper dates match
          if (q.paper_date !== paperDate) return false;

          // Check if question number matches (q.question_number is P-Q-T, we want to match on P-Q)
          const qParts = q.question_number.split('-');
          if (qParts.length < 2) return false;
          const qBaseNumber = `${qParts[0]}-${qParts[1]}`; // P-Q

          return qBaseNumber === questionNumberStr;
        });

        if (matchingQuestions.length > 0) {
          // Update all matching questions with solution objectives
          for (const matchingQuestion of matchingQuestions) {
            try {
              const solutionObjectivesJson = JSON.stringify(solution.solutionObjectives);

              await db.run(
                'UPDATE questions SET solution_objectives = ? WHERE id = ?',
                [solutionObjectivesJson, matchingQuestion.id]
              );

              questionsUpdated++;
              console.log(`[Process M] ✓ Updated question ${matchingQuestion.id} (${paperDate} ${matchingQuestion.question_number}) with ${solution.solutionObjectives.length} objectives`);
            } catch (error: any) {
              console.error(`[Process M] ✗ Error updating question ${matchingQuestion.id}:`, error.message);
            }
          }

          questionsMatched++;
          console.log(`[Process M] ✓ ${solutionKey} matched to ${matchingQuestions.length} question(s)`);
        } else {
          unmatchedSolutions.push({
            msName,
            solutionKey,
            paperDate,
            questionNumberStr,
            objectiveCount: solution.solutionObjectives.length
          });
          console.log(`[Process M] ✗ ${solutionKey} no matching question found (${paperDate} ${questionNumberStr})`);
        }
      }
    }

    console.log(`[Process M] Matching complete: ${questionsMatched} solutions matched, ${questionsUpdated} questions updated, ${unmatchedSolutions.length} unmatched solutions`);

    // Summary
    const failedMarkschemes = markschemeResults
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value.status === 'failed')
      .map(r => `${r.value.msName}: ${r.value.error}`);

    console.log(`\n[Process M] ========== SUMMARY ==========`);
    console.log(`[Process M] Markschemes: ${successfulMarkschemes.length} successful, ${failedMarkschemes.length} failed`);
    console.log(`[Process M] Solutions matched: ${questionsMatched}`);
    console.log(`[Process M] Questions updated: ${questionsUpdated}`);
    console.log(`[Process M] Unmatched solutions: ${unmatchedSolutions.length}`);

    if (failedMarkschemes.length > 0) {
      console.log(`[Process M] Failed markschemes:`);
      failedMarkschemes.forEach(fm => console.log(`  - ${fm}`));
    }
    if (unmatchedSolutions.length > 0) {
      console.log(`[Process M] Unmatched solutions (no corresponding questions):`);
      unmatchedSolutions.forEach(us => console.log(`  - ${us.solutionKey} (${us.objectiveCount} objectives) from "${us.msName}"`));
    }
    console.log(`[Process M] ================================\n`);

    return NextResponse.json({
      success: failedMarkschemes.length === 0,
      markschemesProcessed: successfulMarkschemes.length,
      markschemesFailed: failedMarkschemes.length,
      solutionsMatched: questionsMatched,
      questionsUpdated,
      unmatchedSolutions: unmatchedSolutions.length,
      failedMarkschemes
    });

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[Process M] ERROR:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
