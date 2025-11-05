import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { extractPaperQuestions } from '@/ai/flows/extract-paper-questions';
import { extractMarkschemesSolutions } from '@/ai/flows/extract-markscheme-solutions';
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
 * Processes multiple exam papers in parallel using the redesigned workflow:
 * 1. Papers and markschemes are processed separately in parallel
 * 2. Results are matched mechanically based on structured data
 * 3. Only matched questions (with solutions) are saved to the database
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

    // Get paper and markscheme names from database for logging
    const dbPapers = await db.all<{ name: string }>(
      'SELECT name FROM past_papers WHERE subject_id = ? ORDER BY id',
      [subjectId]
    );
    const dbMarkschemes = await db.all<{ name: string }>(
      'SELECT name FROM markschemes WHERE subject_id = ? ORDER BY id',
      [subjectId]
    );

    // Prepare data for AI flows
    const topicsInfo = paperTypes.flatMap(pt =>
      pt.topics.map(t => ({ id: t.id, name: t.name, description: t.description }))
    );
    const paperTypesInfo = paperTypes.map(pt => ({ name: pt.name }));

    // Step 1: Process papers and markschemes in parallel
    console.log(`[Batch Extraction] Step 1: Starting parallel extraction...`);
    console.log(`[Batch Extraction]   - Papers stream: ${examPapersDataUris.length} papers`);
    console.log(`[Batch Extraction]   - Markschemes stream: ${markschemesDataUris.length} markschemes`);

    // 1.1: Extract questions from papers (parallel)
    const paperExtractionPromises = examPapersDataUris.map(async (examPaperDataUri, index) => {
      const paperName = dbPapers[index]?.name || `paper-${index + 1}`;
      console.log(`[Paper Stream] Processing paper ${index + 1}/${examPapersDataUris.length}: "${paperName}"`);

      try {
        const result = await extractPaperQuestions({
          examPaperDataUri,
          paperTypes: paperTypesInfo,
          topics: topicsInfo,
        });

        console.log(`[Paper Stream] ✓ Paper ${index + 1} extracted: "${paperName}" → Paper: ${result.paperIdentifier}, Type: ${result.paperTypeIndex}, Questions: ${result.questions.length}`);

        return {
          status: 'success' as const,
          index,
          paperName,
          data: result
        };
      } catch (error: any) {
        console.error(`[Paper Stream] ✗ Paper ${index + 1} failed: ${error.message}`);
        return {
          status: 'failed' as const,
          index,
          paperName,
          error: error.message
        };
      }
    });

    // 1.2: Extract solutions from markschemes (parallel)
    const markschemeExtractionPromises = markschemesDataUris.map(async (markschemeDataUri, index) => {
      const msName = dbMarkschemes[index]?.name || `markscheme-${index + 1}`;
      console.log(`[Markscheme Stream] Processing markscheme ${index + 1}/${markschemesDataUris.length}: "${msName}"`);

      try {
        const result = await extractMarkschemesSolutions({
          markschemeDataUri,
          paperTypes: paperTypesInfo,
        });

        console.log(`[Markscheme Stream] ✓ Markscheme ${index + 1} extracted: "${msName}" → Paper: ${result.paperIdentifier}, Type: ${result.paperTypeIndex}, Solutions: ${result.solutions.length}`);

        return {
          status: 'success' as const,
          index,
          msName,
          data: result
        };
      } catch (error: any) {
        console.error(`[Markscheme Stream] ✗ Markscheme ${index + 1} failed: ${error.message}`);
        return {
          status: 'failed' as const,
          index,
          msName,
          error: error.message
        };
      }
    });

    // Wait for both streams to complete
    const [paperResults, markschemeResults] = await Promise.all([
      Promise.allSettled(paperExtractionPromises),
      Promise.allSettled(markschemeExtractionPromises)
    ]);

    console.log(`[Batch Extraction] Step 1 completed: ${paperResults.length} papers processed, ${markschemeResults.length} markschemes processed`);

    // Extract successful results
    const successfulPapers = paperResults
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value.status === 'success')
      .map(r => r.value);

    const successfulMarkschemes = markschemeResults
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value.status === 'success')
      .map(r => r.value);

    console.log(`[Batch Extraction] Successful extractions: ${successfulPapers.length} papers, ${successfulMarkschemes.length} markschemes`);

    // Log extracted identifiers for debugging
    console.log(`\n[Batch Extraction] Extracted Paper Identifiers:`);
    successfulPapers.forEach((p, idx) => {
      const qCount = p.data.questions.length;
      console.log(`  ${idx + 1}. "${p.data.paperIdentifier}" (Type ${p.data.paperTypeIndex}) - ${qCount} questions`);
    });

    console.log(`\n[Batch Extraction] Extracted Markscheme Identifiers:`);
    successfulMarkschemes.forEach((m, idx) => {
      const sCount = m.data.solutions.length;
      console.log(`  ${idx + 1}. "${m.data.paperIdentifier}" (Type ${m.data.paperTypeIndex}) - ${sCount} solutions`);
    });

    // Step 2: Mechanical matching of questions to solutions
    console.log(`\n[Batch Extraction] Step 2: Matching questions to solutions...`);

    // Exact matching on paper date format (YYYY-MM-P)
    // No fuzzy matching - dates must match exactly

    interface MatchedQuestion {
      paperIndex: number;
      paperName: string;
      paperTypeIndex: number;
      paperIdentifier: string;
      questionId: string;
      topicIndex: number;
      questionText: string;
      summary: string;
      solutionObjectives: string[];
    }

    const matchedQuestions: MatchedQuestion[] = [];
    const unmatchedQuestions: any[] = [];
    const unmatchedSolutions: any[] = [];

    // Match questions to solutions: match on first 4 parts (YYYY-MM-P-Q), use 5th part (topic index)
    for (const paperResult of successfulPapers) {
      const { index: paperIndex, paperName, data: paperData } = paperResult;

      for (const question of paperData.questions) {
        let matched = false;

        // Parse question ID: YYYY-MM-P-Q-T (5 parts)
        const questionParts = question.questionId.split('-');
        if (questionParts.length !== 5) {
          console.warn(`[Matching] ✗ ${question.questionId} has invalid format (expected 5 parts, got ${questionParts.length})`);
          continue;
        }

        // Extract first 4 parts for matching (date-paper-question)
        const matchingKey = questionParts.slice(0, 4).join('-'); // YYYY-MM-P-Q
        const topicIndex = parseInt(questionParts[4], 10); // T

        // Try to find a matching solution by first 4 parts
        for (const msResult of successfulMarkschemes) {
          const { data: msData } = msResult;

          // Find solution with matching first 4 parts (YYYY-MM-P-Q)
          const matchingSolution = msData.solutions.find(
            (sol: any) => sol.questionId === matchingKey
          );

          if (matchingSolution) {
            // Match found
            matchedQuestions.push({
              paperIndex,
              paperName,
              paperTypeIndex: paperData.paperTypeIndex,
              paperIdentifier: paperData.paperIdentifier,
              questionId: question.questionId,
              topicIndex,
              questionText: question.questionText,
              summary: question.summary,
              solutionObjectives: matchingSolution.solutionObjectives
            });
            matched = true;
            console.log(`[Matching] ✓ ${matchingKey} matched, topic index: ${topicIndex}`);
            break;
          }
        }

        if (!matched) {
          unmatchedQuestions.push({
            paperName,
            paperIdentifier: paperData.paperIdentifier,
            paperTypeIndex: paperData.paperTypeIndex,
            questionId: question.questionId,
            topicIndex
          });
          console.log(`[Matching] ✗ ${matchingKey} unmatched (full ID: ${question.questionId})`);
        }
      }
    }

    // Find unmatched solutions (solutions without corresponding questions)
    for (const msResult of successfulMarkschemes) {
      const { msName, data: msData } = msResult;

      for (const solution of msData.solutions) {
        // Check if any matched question has this solution ID (first 4 parts)
        const isMatched = matchedQuestions.some(mq => {
          const questionParts = mq.questionId.split('-');
          const matchingKey = questionParts.slice(0, 4).join('-');
          return matchingKey === solution.questionId;
        });

        if (!isMatched) {
          unmatchedSolutions.push({
            msName,
            paperIdentifier: msData.paperIdentifier,
            paperTypeIndex: msData.paperTypeIndex,
            questionId: solution.questionId
          });
          console.log(`[Matching] ✗ ${solution.questionId} solution unmatched`);
        }
      }
    }

    console.log(`[Batch Extraction] Matching complete: ${matchedQuestions.length} matched, ${unmatchedQuestions.length} unmatched questions, ${unmatchedSolutions.length} unmatched solutions`);

    // Step 3: Save matched questions to database
    console.log(`[Batch Extraction] Step 3: Saving ${matchedQuestions.length} matched questions to database...`);

    let totalQuestionsSaved = 0;

    for (const matchedQuestion of matchedQuestions) {
      try {
        // Get topic ID from topicsInfo using topic index
        const allTopics = paperTypes.flatMap(pt => pt.topics);
        const topic = allTopics[matchedQuestion.topicIndex];

        if (!topic) {
          console.warn(`[Database] Skipping question ${matchedQuestion.questionId}: Topic index ${matchedQuestion.topicIndex} out of range (total topics: ${allTopics.length})`);
          continue;
        }

        const topicId = topic.id;
        const solutionObjectivesJson = JSON.stringify(matchedQuestion.solutionObjectives);

        await db.run(
          'INSERT INTO questions (topic_id, question_text, summary, solution_objectives) VALUES (?, ?, ?, ?)',
          [topicId, matchedQuestion.questionText, matchedQuestion.summary, solutionObjectivesJson]
        );

        totalQuestionsSaved++;
        console.log(`[Database] ✓ Saved question ${matchedQuestion.questionId} → Topic: ${topic.name}`);
      } catch (error: any) {
        console.error(`[Database] Error saving question ${matchedQuestion.questionId} from "${matchedQuestion.paperName}":`, error.message);
      }
    }

    console.log(`[Batch Extraction] Database save complete: ${totalQuestionsSaved} questions saved`);

    // Summary
    const failedPapers = paperResults
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value.status === 'failed')
      .map(r => `${r.value.paperName}: ${r.value.error}`);

    const failedMarkschemes = markschemeResults
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value.status === 'failed')
      .map(r => `${r.value.msName}: ${r.value.error}`);

    console.log(`\n[Batch Extraction] ========== SUMMARY ==========`);
    console.log(`[Batch Extraction] Papers: ${successfulPapers.length} successful, ${failedPapers.length} failed`);
    console.log(`[Batch Extraction] Markschemes: ${successfulMarkschemes.length} successful, ${failedMarkschemes.length} failed`);
    console.log(`[Batch Extraction] Questions matched: ${matchedQuestions.length}`);
    console.log(`[Batch Extraction] Questions saved: ${totalQuestionsSaved}`);
    console.log(`[Batch Extraction] Unmatched questions: ${unmatchedQuestions.length}`);
    console.log(`[Batch Extraction] Unmatched solutions: ${unmatchedSolutions.length}`);

    if (failedPapers.length > 0) {
      console.log(`[Batch Extraction] Failed papers:`);
      failedPapers.forEach(fp => console.log(`  - ${fp}`));
    }
    if (failedMarkschemes.length > 0) {
      console.log(`[Batch Extraction] Failed markschemes:`);
      failedMarkschemes.forEach(fm => console.log(`  - ${fm}`));
    }
    if (unmatchedQuestions.length > 0) {
      console.log(`[Batch Extraction] Unmatched questions (no corresponding solutions):`);
      unmatchedQuestions.forEach(uq => console.log(`  - ${uq.questionId} (topic index: ${uq.topicIndex})`));
    }
    if (unmatchedSolutions.length > 0) {
      console.log(`[Batch Extraction] Unmatched solutions (no corresponding questions):`);
      unmatchedSolutions.forEach(us => console.log(`  - ${us.questionId}`));
    }
    console.log(`[Batch Extraction] ================================\n`);

    return NextResponse.json({
      success: failedPapers.length === 0 && failedMarkschemes.length === 0,
      papersProcessed: successfulPapers.length,
      papersFailed: failedPapers.length,
      markschemesProcessed: successfulMarkschemes.length,
      markschemesFailed: failedMarkschemes.length,
      questionsMatched: matchedQuestions.length,
      questionsSaved: totalQuestionsSaved,
      unmatchedQuestions: unmatchedQuestions.length,
      unmatchedSolutions: unmatchedSolutions.length,
      failedPapers,
      failedMarkschemes
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
