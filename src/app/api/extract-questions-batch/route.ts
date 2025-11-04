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
      pt.topics.map(t => ({ name: t.name, description: t.description }))
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

    // Helper function to normalize paper identifiers for fuzzy matching
    const normalizePaperIdentifier = (identifier: string): string => {
      return identifier
        .toLowerCase()
        .replace(/[_\s-/]+/g, '') // Remove separators including slashes
        .replace(/variant|var|specimen|sample|paper/gi, '') // Remove common keywords
        .replace(/\(.+?\)/g, '') // Remove parentheses and content
        .replace(/[^\w]/g, '') // Remove any remaining non-alphanumeric
        .trim();
    };

    // Helper function to check if two identifiers match (fuzzy)
    const identifiersMatch = (id1: string, id2: string): boolean => {
      const norm1 = normalizePaperIdentifier(id1);
      const norm2 = normalizePaperIdentifier(id2);

      // Exact match after normalization
      if (norm1 === norm2) return true;

      // Contains match (for cases like "2022 June" vs "June 2022")
      if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

      // Check if they share a significant portion (year + month)
      // Extract year patterns (4 consecutive digits)
      const year1 = norm1.match(/\d{4}/)?.[0];
      const year2 = norm2.match(/\d{4}/)?.[0];

      if (year1 && year2 && year1 === year2) {
        // Years match, check for month overlap
        const months = ['january', 'february', 'march', 'april', 'may', 'june',
                        'july', 'august', 'september', 'october', 'november', 'december',
                        'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

        for (const month of months) {
          if (norm1.includes(month) && norm2.includes(month)) {
            return true; // Same year and month found
          }
        }
      }

      return false;
    };

    interface MatchedQuestion {
      paperIndex: number;
      paperName: string;
      paperTypeIndex: number;
      paperIdentifier: string;
      questionNumber: number;
      topicName: string;
      questionText: string;
      summary: string;
      solutionObjectives: string[];
    }

    const matchedQuestions: MatchedQuestion[] = [];
    const unmatchedQuestions: any[] = [];
    const unmatchedSolutions: any[] = [];

    // Match each question to its solution
    for (const paperResult of successfulPapers) {
      const { index: paperIndex, paperName, data: paperData } = paperResult;

      for (const question of paperData.questions) {
        let matched = false;

        // Try to find a matching solution
        for (const msResult of successfulMarkschemes) {
          const { data: msData } = msResult;

          // Check if paper types match
          if (paperData.paperTypeIndex !== msData.paperTypeIndex) continue;

          // Check if paper identifiers match (fuzzy)
          if (!identifiersMatch(paperData.paperIdentifier, msData.paperIdentifier)) continue;

          // Find solution with matching question number
          const matchingSolution = msData.solutions.find(
            (sol: any) => sol.questionNumber === question.questionNumber
          );

          if (matchingSolution) {
            // We found a match!
            matchedQuestions.push({
              paperIndex,
              paperName,
              paperTypeIndex: paperData.paperTypeIndex,
              paperIdentifier: paperData.paperIdentifier,
              questionNumber: question.questionNumber,
              topicName: question.topicName,
              questionText: question.questionText,
              summary: question.summary,
              solutionObjectives: matchingSolution.solutionObjectives
            });
            matched = true;
            console.log(`[Matching] ✓ Matched question: Paper "${paperData.paperIdentifier}" Type ${paperData.paperTypeIndex} Q${question.questionNumber} → Topic: ${question.topicName}`);
            break;
          }
        }

        if (!matched) {
          unmatchedQuestions.push({
            paperName,
            paperIdentifier: paperData.paperIdentifier,
            paperTypeIndex: paperData.paperTypeIndex,
            questionNumber: question.questionNumber,
            topicName: question.topicName
          });
          console.log(`[Matching] ✗ Unmatched question: Paper "${paperData.paperIdentifier}" Type ${paperData.paperTypeIndex} Q${question.questionNumber}`);
        }
      }
    }

    // Find unmatched solutions (solutions without corresponding questions)
    for (const msResult of successfulMarkschemes) {
      const { msName, data: msData } = msResult;

      for (const solution of msData.solutions) {
        const isMatched = matchedQuestions.some(
          mq => mq.paperTypeIndex === msData.paperTypeIndex &&
                identifiersMatch(mq.paperIdentifier, msData.paperIdentifier) &&
                mq.questionNumber === solution.questionNumber
        );

        if (!isMatched) {
          unmatchedSolutions.push({
            msName,
            paperIdentifier: msData.paperIdentifier,
            paperTypeIndex: msData.paperTypeIndex,
            questionNumber: solution.questionNumber
          });
          console.log(`[Matching] ✗ Unmatched solution: Markscheme "${msData.paperIdentifier}" Type ${msData.paperTypeIndex} Q${solution.questionNumber}`);
        }
      }
    }

    console.log(`[Batch Extraction] Matching complete: ${matchedQuestions.length} matched, ${unmatchedQuestions.length} unmatched questions, ${unmatchedSolutions.length} unmatched solutions`);

    // Step 3: Save matched questions to database
    console.log(`[Batch Extraction] Step 3: Saving ${matchedQuestions.length} matched questions to database...`);

    let totalQuestionsSaved = 0;

    for (const matchedQuestion of matchedQuestions) {
      try {
        // Find matching topic in database
        let topicId: string | null = null;

        for (const pt of paperTypes) {
          // Match paper type by index
          const paperTypeName = paperTypesInfo[matchedQuestion.paperTypeIndex]?.name;
          const matchesPaperType = paperTypeName === pt.name ||
                                   pt.name.includes(paperTypeName) ||
                                   paperTypeName.includes(pt.name);

          if (!matchesPaperType) continue;

          // Match topic by name
          for (const topic of pt.topics) {
            const matchesTopic = topic.name.toLowerCase().includes(matchedQuestion.topicName.toLowerCase()) ||
                                matchedQuestion.topicName.toLowerCase().includes(topic.name.toLowerCase());

            if (matchesTopic) {
              topicId = topic.id;
              break;
            }
          }

          if (topicId) break;
        }

        if (!topicId) {
          console.warn(`[Database] Skipping question: Could not find matching topic for "${matchedQuestion.topicName}"`);
          continue;
        }

        const solutionObjectivesJson = JSON.stringify(matchedQuestion.solutionObjectives);

        await db.run(
          'INSERT INTO questions (topic_id, question_text, summary, solution_objectives) VALUES (?, ?, ?, ?)',
          [topicId, matchedQuestion.questionText, matchedQuestion.summary, solutionObjectivesJson]
        );

        totalQuestionsSaved++;
      } catch (error: any) {
        console.error(`[Database] Error saving question Q${matchedQuestion.questionNumber} from "${matchedQuestion.paperName}":`, error.message);
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
      unmatchedQuestions.forEach(uq => console.log(`  - ${uq.paperName} (${uq.paperIdentifier}) Type ${uq.paperTypeIndex} Q${uq.questionNumber}: ${uq.topicName}`));
    }
    if (unmatchedSolutions.length > 0) {
      console.log(`[Batch Extraction] Unmatched solutions (no corresponding questions):`);
      unmatchedSolutions.forEach(us => console.log(`  - ${us.msName} (${us.paperIdentifier}) Type ${us.paperTypeIndex} Q${us.questionNumber}`));
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
