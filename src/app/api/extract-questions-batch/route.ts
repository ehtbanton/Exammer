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
 * 3. Questions are saved with or without solutions (depending on markschemes presence)
 * 4. Each question stores paper_date and question_number for future matching
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
      const monthPadded = p.data.month.toString().padStart(2, '0');
      console.log(`  ${idx + 1}. ${p.data.year}-${monthPadded} "${p.data.paperTypeName}" - ${qCount} questions`);
    });

    console.log(`\n[Batch Extraction] Extracted Markscheme Identifiers:`);
    successfulMarkschemes.forEach((m, idx) => {
      const sCount = m.data.solutions.length;
      const monthPadded = m.data.month.toString().padStart(2, '0');
      console.log(`  ${idx + 1}. ${m.data.year}-${monthPadded} "${m.data.paperTypeName}" - ${sCount} solutions`);
    });

    // Step 2: Preprocess markschemes with fuzzy matching
    console.log(`\n[Batch Extraction] Step 2: ${markschemesDataUris.length > 0 ? 'Processing markschemes and matching to questions...' : 'Processing questions without markschemes...'}`);

    // Build solution lookup map: key = "YYYY-MM-P-Q", value = solution objectives
    const solutionMap = new Map<string, string[]>();

    if (markschemesDataUris.length > 0) {
      for (const msResult of successfulMarkschemes) {
        const { msName, data: msData } = msResult;

        // Fuzzy match paper type name for markscheme
        const aiPaperTypeName = msData.paperTypeName || '';
        if (!aiPaperTypeName.trim()) {
          console.warn(`[Markscheme Processing] ✗ Markscheme "${msName}" missing paper type name, skipping`);
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
            console.log(`[Markscheme Processing] ✓ Fuzzy matched paper type: AI="${aiPaperTypeName}" → DB="${dbPaperType.name}" (index ${paperTypeIndex})`);
            break;
          }
        }

        if (!matchedPaperType || paperTypeIndex === -1) {
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
      questionText: string;
      summary: string;
      solutionObjectives?: string[]; // Optional - may be null if no markscheme
      diagramDescription?: string; // Optional - diagram description for image generation
      paperDate: string; // e.g., "2022-06"
      questionNumber: string; // e.g., "1-3-5"
    }

    const questionsToSave: QuestionToSave[] = [];
    const unmatchedQuestions: any[] = [];
    const unmatchedSolutions: any[] = [];

    // Process all questions: match to solutions if markschemes provided
    for (const paperResult of successfulPapers) {
      const { index: paperIndex, paperName, data: paperData } = paperResult;

      // Step 1: Fuzzy match paper type name to find paper type index
      const aiPaperTypeName = paperData.paperTypeName || '';
      if (!aiPaperTypeName.trim()) {
        console.warn(`[Processing] ✗ Paper "${paperName}" missing paper type name, skipping all questions`);
        continue;
      }

      let matchedPaperType = null;
      let paperTypeIndex = -1;

      for (let i = 0; i < paperTypes.length; i++) {
        const dbPaperType = paperTypes[i];
        const dbPaperTypeLower = dbPaperType.name.toLowerCase();
        const aiPaperTypeLower = aiPaperTypeName.toLowerCase();

        // Bidirectional case-insensitive substring matching (from old system)
        const dbContainsAi = dbPaperTypeLower.includes(aiPaperTypeLower);
        const aiContainsDb = aiPaperTypeLower.includes(dbPaperTypeLower);

        if (dbContainsAi || aiContainsDb) {
          matchedPaperType = dbPaperType;
          paperTypeIndex = i;
          console.log(`[Processing] ✓ Fuzzy matched paper type: AI="${aiPaperTypeName}" → DB="${dbPaperType.name}" (index ${paperTypeIndex})`);
          break;
        }
      }

      if (!matchedPaperType || paperTypeIndex === -1) {
        console.warn(`[Processing] ✗ Paper "${paperName}" paper type "${aiPaperTypeName}" could not be matched to any database paper type, skipping all questions`);
        continue;
      }

      // Construct paper identifier: YYYY-MM-P
      const monthPadded = paperData.month.toString().padStart(2, '0');
      const paperIdentifier = `${paperData.year}-${monthPadded}-${paperTypeIndex}`;
      const paperDate = `${paperData.year}-${monthPadded}`; // YYYY-MM

      // Step 2: Process each question
      for (const question of paperData.questions) {
        const questionNumber = question.questionNumber;
        if (typeof questionNumber !== 'number' || questionNumber < 1) {
          console.warn(`[Processing] ✗ Paper "${paperName}" has question with invalid number: ${questionNumber}, skipping`);
          continue;
        }

        // Get topic name from AI output
        const aiTopicName = question.topicName || '';
        if (!aiTopicName.trim()) {
          console.warn(`[Processing] ✗ Paper "${paperName}" Q${questionNumber} missing topic name, skipping`);
          continue;
        }

        // Fuzzy match topic name to find correct topic (using old system's bidirectional substring matching)
        const allTopics = paperTypes.flatMap(pt => pt.topics);
        let matchedTopic = null;
        let topicIndex = -1;

        for (let i = 0; i < allTopics.length; i++) {
          const dbTopic = allTopics[i];
          const dbTopicLower = dbTopic.name.toLowerCase();
          const aiTopicLower = aiTopicName.toLowerCase();

          // Bidirectional case-insensitive substring matching (from old system)
          const dbContainsAi = dbTopicLower.includes(aiTopicLower);
          const aiContainsDb = aiTopicLower.includes(dbTopicLower);

          if (dbContainsAi || aiContainsDb) {
            matchedTopic = dbTopic;
            topicIndex = i;
            console.log(`[Processing] ✓ Q${questionNumber} fuzzy matched topic: AI="${aiTopicName}" → DB="${dbTopic.name}" (index ${topicIndex})`);
            break;
          }
        }

        if (!matchedTopic || topicIndex === -1) {
          console.warn(`[Processing] ✗ Paper "${paperName}" Q${questionNumber} topic "${aiTopicName}" could not be matched to any database topic, skipping`);
          continue;
        }

        // Construct identifiers
        const questionNumberStr = `${paperTypeIndex}-${questionNumber}-${topicIndex}`; // P-Q-T (for database storage)
        const matchingKey = `${paperIdentifier}-${questionNumber}`; // YYYY-MM-P-Q (for markscheme matching)
        const fullQuestionId = `${matchingKey}-${topicIndex}`; // YYYY-MM-P-Q-T (complete ID with matched topic)

        // Look up solution from preprocessed map
        let solutionObjectives: string[] | undefined = undefined;

        if (solutionMap.size > 0) {
          solutionObjectives = solutionMap.get(matchingKey);

          if (solutionObjectives) {
            console.log(`[Processing] ✓ ${matchingKey} matched with solution (${solutionObjectives.length} objectives) → topic: ${matchedTopic.name}`);
          } else {
            unmatchedQuestions.push({
              paperName,
              paperIdentifier,
              paperTypeIndex,
              questionId: fullQuestionId,
              topicIndex,
              topicName: matchedTopic.name
            });
            console.log(`[Processing] ℹ ${matchingKey} has no matching solution (will save without objectives) → topic: ${matchedTopic.name}`);
          }
        } else {
          console.log(`[Processing] ℹ ${matchingKey} processing without markscheme → topic: ${matchedTopic.name}`);
        }

        // Add question to save list (with or without solution objectives)
        questionsToSave.push({
          paperIndex,
          paperName,
          paperTypeIndex,
          paperIdentifier,
          questionId: fullQuestionId,
          topicIndex,
          questionText: question.questionText,
          summary: question.summary,
          solutionObjectives,
          diagramDescription: question.diagramDescription,
          paperDate,
          questionNumber: questionNumberStr
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
    console.log(`[Batch Extraction] Processing complete: ${questionsToSave.length} questions total (${questionsWithSolutions} with solutions, ${questionsWithoutSolutions} without), ${unmatchedSolutions.length} unmatched solutions`);

    // Step 3: Save all questions to database
    console.log(`[Batch Extraction] Step 3: Saving ${questionsToSave.length} questions to database...`);

    let totalQuestionsSaved = 0;

    for (const question of questionsToSave) {
      try {
        // Get topic ID from topicsInfo using topic index
        const allTopics = paperTypes.flatMap(pt => pt.topics);
        const topic = allTopics[question.topicIndex];

        if (!topic) {
          console.warn(`[Database] Skipping question ${question.questionId}: Topic index ${question.topicIndex} out of range (total topics: ${allTopics.length})`);
          continue;
        }

        const topicId = topic.id;
        const solutionObjectivesJson = question.solutionObjectives ? JSON.stringify(question.solutionObjectives) : null;
        const diagramDescription = question.diagramDescription || null;

        await db.run(
          'INSERT INTO questions (topic_id, question_text, summary, solution_objectives, paper_date, question_number, diagram_description) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [topicId, question.questionText, question.summary, solutionObjectivesJson, question.paperDate, question.questionNumber, diagramDescription]
        );

        totalQuestionsSaved++;
        const hasMarkscheme = question.solutionObjectives ? '✓ with solution' : '○ no solution';
        console.log(`[Database] ✓ Saved question ${question.questionId} ${hasMarkscheme} → Topic: ${topic.name}`);
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
