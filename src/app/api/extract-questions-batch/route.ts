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
 * Processes multiple exam papers in parallel using index-based categorization:
 * 1. Papers and markschemes are processed separately in parallel
 * 2. AI returns indices (not names) for paper types and topics - NO fuzzy matching needed
 * 3. Results are matched mechanically based on structured data
 * 4. Questions are saved with confidence scores and reasoning
 * 5. Each question stores paper_date and question_number for future matching
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

    // Prepare data for AI flows - add indices to paper types and topics
    const paperTypesWithIndices = paperTypes.map((pt, ptIndex) => ({
      index: ptIndex,
      name: pt.name,
      topics: pt.topics.map((t, tIndex) => {
        // Calculate global topic index by counting all topics before this paper type
        const topicsBeforeThisPaperType = paperTypes.slice(0, ptIndex).reduce((acc, prevPt) => acc + prevPt.topics.length, 0);
        const globalTopicIndex = topicsBeforeThisPaperType + tIndex;
        return {
          index: globalTopicIndex,
          name: t.name,
          description: t.description
        };
      })
    }));

    // Create a flat array of all topics with global indices
    const allTopicsFlat = paperTypes.flatMap((pt, ptIndex) => {
      const topicsBeforeThisPaperType = paperTypes.slice(0, ptIndex).reduce((acc, prevPt) => acc + prevPt.topics.length, 0);
      return pt.topics.map((t, tIndex) => ({
        index: topicsBeforeThisPaperType + tIndex,
        id: t.id,
        name: t.name,
        description: t.description
      }));
    });

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
          paperTypes: paperTypesWithIndices,
          topics: allTopicsFlat,
        });

        console.log(`[Paper Stream] ✓ Paper ${index + 1} extracted: "${paperName}" → Type: ${result.paperTypeIndex}, Confidence: ${result.paperTypeConfidence}%, Questions: ${result.questions.length}`);

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
          paperTypes: paperTypesWithIndices.map(pt => ({ name: pt.name })),
        });

        console.log(`[Markscheme Stream] ✓ Markscheme ${index + 1} extracted: "${msName}" → Solutions: ${result.solutions.length}`);

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
    console.log(`\n[Batch Extraction] Extracted Paper Information:`);
    successfulPapers.forEach((p, idx) => {
      const qCount = p.data.questions.length;
      const monthPadded = p.data.month.toString().padStart(2, '0');
      const paperTypeName = paperTypesWithIndices[p.data.paperTypeIndex]?.name || `Type ${p.data.paperTypeIndex}`;
      console.log(`  ${idx + 1}. ${p.data.year}-${monthPadded} "${paperTypeName}" (confidence: ${p.data.paperTypeConfidence}%) - ${qCount} questions`);
    });

    console.log(`\n[Batch Extraction] Extracted Markscheme Information:`);
    successfulMarkschemes.forEach((m, idx) => {
      const sCount = m.data.solutions.length;
      const monthPadded = m.data.month.toString().padStart(2, '0');
      console.log(`  ${idx + 1}. ${m.data.year}-${monthPadded} - ${sCount} solutions`);
    });

    // Step 2: Process markschemes and build solution lookup map
    console.log(`\n[Batch Extraction] Step 2: ${markschemesDataUris.length > 0 ? 'Processing markschemes and matching to questions...' : 'Processing questions without markschemes...'}`);

    // Build solution lookup map: key = "YYYY-MM-P-Q", value = solution objectives
    const solutionMap = new Map<string, string[]>();

    if (markschemesDataUris.length > 0) {
      for (const msResult of successfulMarkschemes) {
        const { msName, data: msData } = msResult;

        // Extract paper type name from markscheme
        const aiPaperTypeName = msData.paperTypeName || '';
        if (!aiPaperTypeName.trim()) {
          console.warn(`[Markscheme Processing] ✗ Markscheme "${msName}" missing paper type name, skipping`);
          continue;
        }

        // Fuzzy match paper type name (still needed for markschemes until we update their extraction too)
        let paperTypeIndex = -1;
        for (let i = 0; i < paperTypes.length; i++) {
          const dbPaperType = paperTypes[i];
          const dbPaperTypeLower = dbPaperType.name.toLowerCase();
          const aiPaperTypeLower = aiPaperTypeName.toLowerCase();

          const dbContainsAi = dbPaperTypeLower.includes(aiPaperTypeLower);
          const aiContainsDb = aiPaperTypeLower.includes(dbPaperTypeLower);

          if (dbContainsAi || aiContainsDb) {
            paperTypeIndex = i;
            console.log(`[Markscheme Processing] ✓ Fuzzy matched paper type: AI="${aiPaperTypeName}" → DB="${dbPaperType.name}" (index ${paperTypeIndex})`);
            break;
          }
        }

        if (paperTypeIndex === -1) {
          console.warn(`[Markscheme Processing] ✗ Markscheme "${msName}" paper type "${aiPaperTypeName}" could not be matched, skipping`);
          continue;
        }

        // Construct paper identifier for this markscheme
        const monthPadded = msData.month.toString().padStart(2, '0');
        const msPaperIdentifier = `${msData.year}-${monthPadded}-${paperTypeIndex}`;

        // Add all solutions to the map
        for (const solution of msData.solutions) {
          const solutionKey = `${msPaperIdentifier}-${solution.questionNumber}`;
          solutionMap.set(solutionKey, solution.solutionObjectives);
          console.log(`[Markscheme Processing] ✓ Indexed solution: ${solutionKey} (${solution.solutionObjectives.length} objectives)`);
        }
      }

      console.log(`[Markscheme Processing] Indexed ${solutionMap.size} solutions for matching`);
    }

    interface QuestionToSave {
      paperIndex: number;
      paperName: string;
      paperTypeIndex: number;
      paperIdentifier: string;
      questionId: string;
      topicIndex: number;
      topicId: string;
      questionText: string;
      summary: string;
      solutionObjectives?: string[]; // Optional - may be null if no markscheme
      diagramData?: any; // Optional - geometric diagram data (custom schema)
      paperDate: string; // e.g., "2022-06"
      questionNumber: string; // e.g., "1-3-5"
      categorizationConfidence: number; // 0-100
      categorizationReasoning: string;
    }

    const questionsToSave: QuestionToSave[] = [];
    const unmatchedQuestions: any[] = [];
    const unmatchedSolutions: any[] = [];

    // Process all questions using index-based approach (NO fuzzy matching)
    for (const paperResult of successfulPapers) {
      const { index: paperIndex, paperName, data: paperData } = paperResult;

      // Paper type index is already determined by AI
      const paperTypeIndex = paperData.paperTypeIndex;

      // Validate paper type index
      if (paperTypeIndex < 0 || paperTypeIndex >= paperTypes.length) {
        console.warn(`[Processing] ✗ Paper "${paperName}" has invalid paper type index ${paperTypeIndex}, skipping all questions`);
        continue;
      }

      const paperTypeName = paperTypes[paperTypeIndex].name;

      // Construct paper identifier: YYYY-MM-P
      const monthPadded = paperData.month.toString().padStart(2, '0');
      const paperIdentifier = `${paperData.year}-${monthPadded}-${paperTypeIndex}`;
      const paperDate = `${paperData.year}-${monthPadded}`; // YYYY-MM

      console.log(`[Processing] Processing paper "${paperName}" → Type: ${paperTypeName} (index ${paperTypeIndex}), Date: ${paperDate}, Confidence: ${paperData.paperTypeConfidence}%`);

      // Step 2: Process each question
      for (const question of paperData.questions) {
        const questionNumber = question.questionNumber;
        if (typeof questionNumber !== 'number' || questionNumber < 1) {
          console.warn(`[Processing] ✗ Paper "${paperName}" has question with invalid number: ${questionNumber}, skipping`);
          continue;
        }

        // Get topic index directly from AI output (NO fuzzy matching)
        const topicIndex = question.topicIndex;

        // Validate topic index
        if (topicIndex < 0 || topicIndex >= allTopicsFlat.length) {
          console.warn(`[Processing] ✗ Paper "${paperName}" Q${questionNumber} has invalid topic index ${topicIndex} (valid range: 0-${allTopicsFlat.length - 1}), skipping`);
          continue;
        }

        // Get topic from flat array using index
        const topic = allTopicsFlat[topicIndex];
        const topicId = topic.id;
        const topicName = topic.name;

        // Get categorization confidence and reasoning
        const categorizationConfidence = question.categorizationConfidence;
        const categorizationReasoning = question.categorizationReasoning;

        // Log low confidence warnings
        if (categorizationConfidence < 70) {
          console.warn(`[Processing] ⚠ Q${questionNumber} low confidence (${categorizationConfidence}%): ${categorizationReasoning}`);
        }

        // Construct identifiers
        const questionNumberStr = `${paperTypeIndex}-${questionNumber}-${topicIndex}`; // P-Q-T (for database storage)
        const matchingKey = `${paperIdentifier}-${questionNumber}`; // YYYY-MM-P-Q (for markscheme matching)
        const fullQuestionId = `${matchingKey}-${topicIndex}`; // YYYY-MM-P-Q-T (complete ID)

        // Look up solution from preprocessed map
        let solutionObjectives: string[] | undefined = undefined;

        if (solutionMap.size > 0) {
          solutionObjectives = solutionMap.get(matchingKey);

          if (solutionObjectives) {
            console.log(`[Processing] ✓ ${matchingKey} matched with solution (${solutionObjectives.length} objectives) → topic: ${topicName} (confidence: ${categorizationConfidence}%)`);
          } else {
            unmatchedQuestions.push({
              paperName,
              paperIdentifier,
              paperTypeIndex,
              questionId: fullQuestionId,
              topicIndex,
              topicName
            });
            console.log(`[Processing] ℹ ${matchingKey} has no matching solution (will save without objectives) → topic: ${topicName} (confidence: ${categorizationConfidence}%)`);
          }
        } else {
          console.log(`[Processing] ℹ ${matchingKey} processing without markscheme → topic: ${topicName} (confidence: ${categorizationConfidence}%)`);
        }

        // Add question to save list (with confidence and reasoning)
        questionsToSave.push({
          paperIndex,
          paperName,
          paperTypeIndex,
          paperIdentifier,
          questionId: fullQuestionId,
          topicIndex,
          topicId,
          questionText: question.questionText,
          summary: question.summary,
          solutionObjectives,
          diagramData: question.diagramData,
          paperDate,
          questionNumber: questionNumberStr,
          categorizationConfidence,
          categorizationReasoning
        });
      }
    }

    // Find unmatched solutions (solutions without corresponding questions)
    if (solutionMap.size > 0) {
      // Get all matched solution keys from questions
      const matchedSolutionKeys = new Set<string>();
      for (const question of questionsToSave) {
        if (question.solutionObjectives) {
          const questionParts = question.questionId.split('-');
          const matchingKey = questionParts.slice(0, 4).join('-'); // YYYY-MM-P-Q
          matchedSolutionKeys.add(matchingKey);
        }
      }

      // Check which solutions in the map were not matched
      for (const [solutionKey, objectives] of solutionMap.entries()) {
        if (!matchedSolutionKeys.has(solutionKey)) {
          unmatchedSolutions.push({
            solutionKey,
            objectiveCount: objectives.length
          });
          console.log(`[Processing] ✗ ${solutionKey} solution unmatched (${objectives.length} objectives)`);
        }
      }
    }

    const questionsWithSolutions = questionsToSave.filter(q => q.solutionObjectives).length;
    const questionsWithoutSolutions = questionsToSave.filter(q => !q.solutionObjectives).length;
    const lowConfidenceCount = questionsToSave.filter(q => q.categorizationConfidence < 70).length;
    console.log(`[Batch Extraction] Processing complete: ${questionsToSave.length} questions total (${questionsWithSolutions} with solutions, ${questionsWithoutSolutions} without), ${lowConfidenceCount} low confidence (<70%), ${unmatchedSolutions.length} unmatched solutions`);

    // Step 3: Save all questions to database
    console.log(`[Batch Extraction] Step 3: Saving ${questionsToSave.length} questions to database...`);

    let totalQuestionsSaved = 0;

    for (const question of questionsToSave) {
      try {
        const topicId = question.topicId;
        const solutionObjectivesJson = question.solutionObjectives ? JSON.stringify(question.solutionObjectives) : null;
        const diagramDataJson = question.diagramData ? JSON.stringify(question.diagramData) : null;

        await db.run(
          'INSERT INTO questions (topic_id, question_text, summary, solution_objectives, paper_date, question_number, diagram_data, categorization_confidence, categorization_reasoning) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [topicId, question.questionText, question.summary, solutionObjectivesJson, question.paperDate, question.questionNumber, diagramDataJson, question.categorizationConfidence, question.categorizationReasoning]
        );

        totalQuestionsSaved++;
        const hasMarkscheme = question.solutionObjectives ? '✓ with solution' : '○ no solution';
        const confidenceIndicator = question.categorizationConfidence < 70 ? ` [⚠ ${question.categorizationConfidence}%]` : ` [${question.categorizationConfidence}%]`;
        console.log(`[Database] ✓ Saved question ${question.questionId} ${hasMarkscheme}${confidenceIndicator} → Topic: ${allTopicsFlat[question.topicIndex]?.name}`);
      } catch (error: any) {
        console.error(`[Database] Error saving question ${question.questionId} from "${question.paperName}":`, error.message);
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
    console.log(`[Batch Extraction] Questions extracted: ${questionsToSave.length}`);
    console.log(`[Batch Extraction] Questions saved: ${totalQuestionsSaved}`);
    console.log(`[Batch Extraction] Questions with solutions: ${questionsWithSolutions}`);
    console.log(`[Batch Extraction] Questions without solutions: ${questionsWithoutSolutions}`);
    console.log(`[Batch Extraction] Low confidence questions (<70%): ${lowConfidenceCount}`);
    console.log(`[Batch Extraction] Unmatched solutions: ${unmatchedSolutions.length}`);

    if (failedPapers.length > 0) {
      console.log(`[Batch Extraction] Failed papers:`);
      failedPapers.forEach(fp => console.log(`  - ${fp}`));
    }
    if (failedMarkschemes.length > 0) {
      console.log(`[Batch Extraction] Failed markschemes:`);
      failedMarkschemes.forEach(fm => console.log(`  - ${fm}`));
    }
    if (questionsWithoutSolutions > 0 && markschemesDataUris.length > 0) {
      console.log(`[Batch Extraction] Questions without matching solutions:`);
      unmatchedQuestions.forEach(uq => console.log(`  - ${uq.questionId} → ${uq.topicName}`));
    }
    if (unmatchedSolutions.length > 0) {
      console.log(`[Batch Extraction] Unmatched solutions (no corresponding questions):`);
      unmatchedSolutions.forEach(us => console.log(`  - ${us.solutionKey} (${us.objectiveCount} objectives)`));
    }
    if (lowConfidenceCount > 0) {
      console.log(`[Batch Extraction] Low confidence questions (<70%):`);
      questionsToSave.filter(q => q.categorizationConfidence < 70).forEach(q => {
        const topicName = allTopicsFlat[q.topicIndex]?.name;
        console.log(`  - ${q.questionId} → ${topicName} (${q.categorizationConfidence}%): ${q.categorizationReasoning}`);
      });
    }
    console.log(`[Batch Extraction] ================================\n`);

    return NextResponse.json({
      success: failedPapers.length === 0 && failedMarkschemes.length === 0,
      papersProcessed: successfulPapers.length,
      papersFailed: failedPapers.length,
      markschemesProcessed: successfulMarkschemes.length,
      markschemesFailed: failedMarkschemes.length,
      questionsExtracted: questionsToSave.length,
      questionsSaved: totalQuestionsSaved,
      questionsWithSolutions,
      questionsWithoutSolutions,
      lowConfidenceQuestions: lowConfidenceCount,
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
