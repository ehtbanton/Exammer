import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { extractPaperQuestions } from '@/ai/flows/extract-paper-questions';
import { extractMarkschemesSolutions } from '@/ai/flows/extract-markscheme-solutions';
import { db } from '@/lib/db';

export const maxDuration = 300; // 5 minutes max for batch processing
export const dynamic = 'force-dynamic';

interface PaperInfo {
  dataUri: string;
  filename: string;
  paper_type_id: string;
}

interface MarkschemeInfo {
  dataUri: string;
  filename: string;
  paper_type_id: string;
}

interface ExtractQuestionsRequest {
  subjectId: string;
  papers: PaperInfo[];
  markschemes: MarkschemeInfo[];
  paperTypes: Array<{ id: string; name: string; topics: Array<{ id: string; name: string; description: string }> }>;
}

/**
 * POST /api/extract-questions-batch
 *
 * Processes multiple exam papers in parallel:
 * 1. Papers are pre-assigned to paper types (no classification needed)
 * 2. Dates are extracted from filenames
 * 3. Papers and markschemes are processed separately in parallel
 * 4. AI returns topic indices - NO fuzzy matching needed
 * 5. Markschemes are matched by paper_type_id + year + question_number
 * 6. Questions are saved with confidence scores and reasoning
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { subjectId, papers = [], markschemes = [], paperTypes } = await req.json() as ExtractQuestionsRequest;

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

    console.log(`[Batch Extraction] Processing ${papers.length} papers with ${markschemes.length} markschemes for subject ${subjectId}`);

    // Create a map of paper types for easy lookup
    const paperTypeMap = new Map(paperTypes.map(pt => [pt.id, pt]));

    // Step 1: Process papers and markschemes in parallel
    console.log(`[Batch Extraction] Step 1: Starting parallel extraction...`);
    console.log(`[Batch Extraction]   - Papers stream: ${papers.length} papers`);
    console.log(`[Batch Extraction]   - Markschemes stream: ${markschemes.length} markschemes`);

    // 1.1: Extract questions from papers (parallel)
    const paperExtractionPromises = papers.map(async (paper, index) => {
      const paperName = paper.filename;
      console.log(`[Paper Stream] Processing paper ${index + 1}/${papers.length}: "${paperName}"`);

      try {
        // Get topics for this specific paper type
        const paperType = paperTypeMap.get(paper.paper_type_id);
        if (!paperType) {
          throw new Error(`Paper type ${paper.paper_type_id} not found`);
        }

        // Add indices to topics for this paper type
        const topicsWithIndices = paperType.topics.map((t, tIndex) => ({
          index: tIndex,
          id: t.id,
          name: t.name,
          description: t.description
        }));

        const result = await extractPaperQuestions({
          examPaperDataUri: paper.dataUri,
          filename: paper.filename,
          topics: topicsWithIndices,
        });

        console.log(`[Paper Stream] ✓ Paper ${index + 1} extracted: "${paperName}" → Questions: ${result.questions.length}`);

        return {
          status: 'success' as const,
          index,
          paperName,
          paper_type_id: paper.paper_type_id,
          data: result
        };
      } catch (error: any) {
        console.error(`[Paper Stream] ✗ Paper ${index + 1} failed: ${error.message}`);
        return {
          status: 'failed' as const,
          index,
          paperName,
          paper_type_id: paper.paper_type_id,
          error: error.message
        };
      }
    });

    // 1.2: Extract solutions from markschemes (parallel)
    const markschemeExtractionPromises = markschemes.map(async (markscheme, index) => {
      const msName = markscheme.filename;
      console.log(`[Markscheme Stream] Processing markscheme ${index + 1}/${markschemes.length}: "${msName}"`);

      try {
        const result = await extractMarkschemesSolutions({
          markschemeDataUri: markscheme.dataUri,
          filename: markscheme.filename,
        });

        console.log(`[Markscheme Stream] ✓ Markscheme ${index + 1} extracted: "${msName}" → Solutions: ${result.solutions.length}`);

        return {
          status: 'success' as const,
          index,
          msName,
          paper_type_id: markscheme.paper_type_id,
          data: result
        };
      } catch (error: any) {
        console.error(`[Markscheme Stream] ✗ Markscheme ${index + 1} failed: ${error.message}`);
        return {
          status: 'failed' as const,
          index,
          msName,
          paper_type_id: markscheme.paper_type_id,
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

    // Helper function to format date for logging
    const formatDate = (year: number | null, month: number | null, day: number | null): string => {
      if (year === null) return 'No date';
      let dateStr = year.toString();
      if (month !== null) {
        const monthPadded = month.toString().padStart(2, '0');
        dateStr += `-${monthPadded}`;
        if (day !== null) {
          const dayPadded = day.toString().padStart(2, '0');
          dateStr += `-${dayPadded}`;
        }
      }
      return dateStr;
    };

    // Log extracted identifiers for debugging
    console.log(`\n[Batch Extraction] Extracted Paper Information:`);
    successfulPapers.forEach((p, idx) => {
      const qCount = p.data.questions.length;
      const paperType = paperTypeMap.get(p.paper_type_id);
      const paperTypeName = paperType?.name || 'Unknown';
      const dateStr = formatDate(p.data.year, p.data.month, p.data.day);
      console.log(`  ${idx + 1}. ${dateStr} "${paperTypeName}" - ${qCount} questions`);
    });

    console.log(`\n[Batch Extraction] Extracted Markscheme Information:`);
    successfulMarkschemes.forEach((m, idx) => {
      const sCount = m.data.solutions.length;
      const paperType = paperTypeMap.get(m.paper_type_id);
      const paperTypeName = paperType?.name || 'Unknown';
      const dateStr = formatDate(m.data.year, m.data.month, m.data.day);
      console.log(`  ${idx + 1}. ${dateStr} "${paperTypeName}" - ${sCount} solutions`);
    });

    // Step 2: Process markschemes and build solution lookup map
    console.log(`\n[Batch Extraction] Step 2: ${markschemes.length > 0 ? 'Processing markschemes and matching to questions...' : 'Processing questions without markschemes...'}`);

    // Build solution lookup map: key = "paper_type_id-YYYY-Q", value = solution objectives
    // We match by paper_type_id + year + question_number (month/day not required for matching)
    const solutionMap = new Map<string, string[]>();

    if (markschemes.length > 0) {
      for (const msResult of successfulMarkschemes) {
        const { msName, paper_type_id, data: msData } = msResult;

        // Skip if year is null (required for matching)
        if (msData.year === null) {
          console.warn(`[Markscheme Processing] ✗ Markscheme "${msName}" missing year, skipping`);
          continue;
        }

        // Add all solutions to the map
        for (const solution of msData.solutions) {
          // Match key: paper_type_id + year + question number
          const solutionKey = `${paper_type_id}-${msData.year}-${solution.questionNumber}`;
          solutionMap.set(solutionKey, solution.solutionObjectives);
          console.log(`[Markscheme Processing] ✓ Indexed solution: ${solutionKey} (${solution.solutionObjectives.length} objectives)`);
        }
      }

      console.log(`[Markscheme Processing] Indexed ${solutionMap.size} solutions for matching`);
    }

    interface QuestionToSave {
      paperIndex: number;
      paperName: string;
      paper_type_id: string;
      topicId: string;
      questionText: string;
      summary: string;
      solutionObjectives?: string[]; // Optional - may be null if no markscheme
      diagramMermaid?: string; // Optional - mermaid diagram syntax for rendering
      paperDate: string | null; // e.g., "2024-06-15", "2024-06", "2024", or null
      questionNumber: string; // Just the question number (e.g., "1", "2", "3")
      categorizationConfidence: number; // 0-100
      categorizationReasoning: string;
    }

    const questionsToSave: QuestionToSave[] = [];
    const unmatchedQuestions: any[] = [];
    const unmatchedSolutions: any[] = [];

    // Process all questions (NO paper type classification needed)
    for (const paperResult of successfulPapers) {
      const { index: paperIndex, paperName, paper_type_id, data: paperData } = paperResult;

      // Get paper type from map
      const paperType = paperTypeMap.get(paper_type_id);
      if (!paperType) {
        console.warn(`[Processing] ✗ Paper "${paperName}" has invalid paper_type_id ${paper_type_id}, skipping all questions`);
        continue;
      }

      const paperTypeName = paperType.name;

      // Build paper_date from extracted date components (nullable)
      let paperDate: string | null = null;
      if (paperData.year !== null) {
        paperDate = paperData.year.toString();
        if (paperData.month !== null) {
          const monthPadded = paperData.month.toString().padStart(2, '0');
          paperDate += `-${monthPadded}`;
          if (paperData.day !== null) {
            const dayPadded = paperData.day.toString().padStart(2, '0');
            paperDate += `-${dayPadded}`;
          }
        }
      }

      const dateStr = formatDate(paperData.year, paperData.month, paperData.day);
      console.log(`[Processing] Processing paper "${paperName}" → Type: ${paperTypeName}, Date: ${dateStr}`);

      // Process each question
      for (const question of paperData.questions) {
        const questionNumber = question.questionNumber;
        if (typeof questionNumber !== 'number' || questionNumber < 1) {
          console.warn(`[Processing] ✗ Paper "${paperName}" has question with invalid number: ${questionNumber}, skipping`);
          continue;
        }

        // Get topic index directly from AI output (NO fuzzy matching)
        const topicIndex = question.topicIndex;

        // Validate topic index (scoped to this paper type's topics)
        if (topicIndex < 0 || topicIndex >= paperType.topics.length) {
          console.warn(`[Processing] ✗ Paper "${paperName}" Q${questionNumber} has invalid topic index ${topicIndex} (valid range: 0-${paperType.topics.length - 1}), skipping`);
          continue;
        }

        // Get topic from paper type's topics using index
        const topic = paperType.topics[topicIndex];
        const topicId = topic.id;
        const topicName = topic.name;

        // Get categorization confidence and reasoning
        const categorizationConfidence = question.categorizationConfidence;
        const categorizationReasoning = question.categorizationReasoning;

        // Log low confidence warnings
        if (categorizationConfidence < 70) {
          console.warn(`[Processing] ⚠ Q${questionNumber} low confidence (${categorizationConfidence}%): ${categorizationReasoning}`);
        }

        // Construct match key for markscheme lookup: paper_type_id + year + question_number
        // Note: We require year for matching, but not month/day
        let solutionObjectives: string[] | undefined = undefined;

        if (solutionMap.size > 0 && paperData.year !== null) {
          const matchingKey = `${paper_type_id}-${paperData.year}-${questionNumber}`;
          solutionObjectives = solutionMap.get(matchingKey);

          if (solutionObjectives) {
            console.log(`[Processing] ✓ ${matchingKey} matched with solution (${solutionObjectives.length} objectives) → topic: ${topicName} (confidence: ${categorizationConfidence}%)`);
          } else {
            unmatchedQuestions.push({
              paperName,
              paper_type_id,
              year: paperData.year,
              questionNumber,
              topicName
            });
            console.log(`[Processing] ℹ ${matchingKey} has no matching solution (will save without objectives) → topic: ${topicName} (confidence: ${categorizationConfidence}%)`);
          }
        } else if (solutionMap.size > 0 && paperData.year === null) {
          console.log(`[Processing] ℹ Q${questionNumber} cannot match markscheme (no year) → topic: ${topicName} (confidence: ${categorizationConfidence}%)`);
        } else {
          console.log(`[Processing] ℹ Q${questionNumber} processing without markscheme → topic: ${topicName} (confidence: ${categorizationConfidence}%)`);
        }

        // Add question to save list (with confidence and reasoning)
        questionsToSave.push({
          paperIndex,
          paperName,
          paper_type_id,
          topicId,
          questionText: question.questionText,
          summary: question.summary,
          solutionObjectives,
          diagramMermaid: question.diagramMermaid,
          paperDate,
          questionNumber: questionNumber.toString(), // Just the question number
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
        if (question.solutionObjectives && question.paperDate) {
          // Extract year from paperDate (could be "2024-06-15", "2024-06", or "2024")
          const yearMatch = question.paperDate.match(/^(\d{4})/);
          if (yearMatch) {
            const year = yearMatch[1];
            const matchingKey = `${question.paper_type_id}-${year}-${question.questionNumber}`;
            matchedSolutionKeys.add(matchingKey);
          }
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
        const diagramMermaid = question.diagramMermaid || null;

        await db.run(
          'INSERT INTO questions (topic_id, question_text, summary, solution_objectives, paper_date, question_number, diagram_mermaid, categorization_confidence, categorization_reasoning) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [topicId, question.questionText, question.summary, solutionObjectivesJson, question.paperDate, question.questionNumber, diagramMermaid, question.categorizationConfidence, question.categorizationReasoning]
        );

        totalQuestionsSaved++;
        const hasMarkscheme = question.solutionObjectives ? '✓ with solution' : '○ no solution';
        const confidenceIndicator = question.categorizationConfidence < 70 ? ` [⚠ ${question.categorizationConfidence}%]` : ` [${question.categorizationConfidence}%]`;
        const paperType = paperTypeMap.get(question.paper_type_id);
        const topic = paperType?.topics.find(t => t.id === question.topicId);
        console.log(`[Database] ✓ Saved question ${question.questionNumber} ${hasMarkscheme}${confidenceIndicator} → Topic: ${topic?.name || 'Unknown'}`);
      } catch (error: any) {
        console.error(`[Database] Error saving question ${question.questionNumber} from "${question.paperName}":`, error.message);
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
    if (questionsWithoutSolutions > 0 && markschemes.length > 0) {
      console.log(`[Batch Extraction] Questions without matching solutions:`);
      unmatchedQuestions.forEach(uq => console.log(`  - ${uq.paper_type_id}-${uq.year}-${uq.questionNumber} → ${uq.topicName}`));
    }
    if (unmatchedSolutions.length > 0) {
      console.log(`[Batch Extraction] Unmatched solutions (no corresponding questions):`);
      unmatchedSolutions.forEach(us => console.log(`  - ${us.solutionKey} (${us.objectiveCount} objectives)`));
    }
    if (lowConfidenceCount > 0) {
      console.log(`[Batch Extraction] Low confidence questions (<70%):`);
      questionsToSave.filter(q => q.categorizationConfidence < 70).forEach(q => {
        const paperType = paperTypeMap.get(q.paper_type_id);
        const topic = paperType?.topics.find(t => t.id === q.topicId);
        const topicName = topic?.name || 'Unknown';
        console.log(`  - Q${q.questionNumber} → ${topicName} (${q.categorizationConfidence}%): ${q.categorizationReasoning}`);
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
