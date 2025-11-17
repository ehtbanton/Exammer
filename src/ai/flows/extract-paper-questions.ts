'use server';

/**
 * @fileOverview Extracts questions from a single exam paper with index-based categorization.
 *
 * This flow uses content analysis to determine the paper type and categorize questions
 * by topic. Instead of string matching, the AI analyzes question content against topic
 * descriptions and returns indices, eliminating fuzzy matching failures.
 */

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {z} from 'genkit';
import {geminiApiKeyManager} from '@root/gemini-api-key-manager';
import {extractGeometricDiagram} from './extract-geometric-diagram';
import type {GeometricDiagram} from '@/lib/geometric-schema';

const PaperTypeInfoSchema = z.object({
  index: z.number().describe('The 0-based index of this paper type in the provided array.'),
  name: z.string().describe('The name of the paper type.'),
  topics: z.array(z.object({
    index: z.number().describe('The 0-based index of this topic in the global topics array.'),
    name: z.string().describe('The name of the topic.'),
    description: z.string().describe('The description of what this topic covers.'),
  })).describe('Topics covered in this paper type.'),
});

const TopicInfoSchema = z.object({
  index: z.number().describe('The 0-based index of this topic in the provided array.'),
  name: z.string().describe('The name of the topic.'),
  description: z.string().describe('The description of what this topic covers.'),
});

const ExtractPaperQuestionsInputSchema = z.object({
  examPaperDataUri: z
    .string()
    .describe(
      "A single exam paper in PDF format, as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
  paperTypes: z
    .array(PaperTypeInfoSchema)
    .describe('The list of paper types from the syllabus (ordered array with indices).'),
  topics: z
    .array(TopicInfoSchema)
    .describe('The list of all topics from the syllabus (ordered array with indices).'),
});
export type ExtractPaperQuestionsInput = z.infer<typeof ExtractPaperQuestionsInputSchema>;

const PaperQuestionSchema = z.object({
  questionNumber: z.number().describe('Question number from the exam (1, 2, 3, etc.). For multi-part questions, use the main number only.'),
  questionText: z.string().describe('Complete question text including all parts. Remove any diagram source code (Asymptote, TikZ, etc.).'),
  summary: z.string().describe('One-sentence summary of the question.'),
  topicIndex: z.number().describe('0-based index of the topic this question belongs to, determined by content analysis.'),
  categorizationConfidence: z.number().min(0).max(100).describe('Confidence score (0-100) for topic categorization.'),
  categorizationReasoning: z.string().describe('Brief explanation of why this topic was chosen based on question content.'),
});

const ExtractPaperQuestionsOutputSchema = z.object({
  paperTypeIndex: z.number().describe('The 0-based index of the paper type (from the paperTypes array) determined by analyzing which topics best match ALL questions in the paper.'),
  paperTypeConfidence: z.number().min(0).max(100).describe('Your confidence score (0-100) that you correctly identified the paper type. Use 100 for obvious matches, 70-90 for good matches, 50-70 for uncertain matches, below 50 for very uncertain matches.'),
  paperTypeReasoning: z.string().describe('A brief 1-2 sentence explanation of why you chose this paper type based on analyzing all questions in the paper.'),
  year: z.number().describe('The year from the exam paper (4 digits, e.g., 2022).'),
  month: z.number().describe('The month from the exam paper (1-12, e.g., 6 for June).'),
  questions: z.array(PaperQuestionSchema).describe('All questions extracted from this exam paper.'),
});
export type ExtractPaperQuestionsOutput = z.infer<typeof ExtractPaperQuestionsOutputSchema>;

export async function extractPaperQuestions(
  input: ExtractPaperQuestionsInput
): Promise<ExtractPaperQuestionsOutput> {
  const { examPaperDataUri, paperTypes, topics } = input;

  console.log(`[Paper Extraction] Processing exam paper...`);

  const startTime = Date.now();

  try {
    const result = await geminiApiKeyManager.withKey(async (apiKey) => {
      const aiInstance = genkit({
        plugins: [googleAI({ apiKey })],
        model: 'googleai/gemini-2.5-flash-lite',
      });

      const prompt = aiInstance.definePrompt({
        name: 'extractPaperQuestionsPrompt',
        input: {schema: ExtractPaperQuestionsInputSchema},
        output: {schema: ExtractPaperQuestionsOutputSchema},
        prompt: `You are an exam question extractor. Extract questions from exam papers and categorize them by analyzing content against topic descriptions.

CRITICAL RULES:
1. Use content analysis, not string/header matching
2. Remove all diagram source code (Asymptote, TikZ, etc.) from question text
3. Return indices (0-based), not names
4. Provide confidence scores (0-100) and reasoning for all categorizations
5. Combine multi-part questions (1a, 1b, 1c) under the main number
6. Extract year (4 digits) and month (1-12) from the paper header

PAPER TYPES:
{{#each paperTypes}}
[{{index}}] {{name}}
{{#each topics}}
  - [{{index}}] {{name}}: {{description}}
{{/each}}
{{/each}}

EXAM PAPER:
{{media url=examPaperDataUri}}

INSTRUCTIONS:
1. Determine paper type by analyzing which topics best match ALL questions (return index)
2. Extract each question (combine multi-part questions like 1a, 1b under main number)
3. Remove any diagram source code from question text
4. Categorize each question by topic using content analysis (return topic index)
5. Extract year and month from paper header
6. Provide confidence scores and reasoning for all categorizations`,
      });

      const flow = aiInstance.defineFlow(
        {
          name: 'extractPaperQuestionsFlow',
          inputSchema: ExtractPaperQuestionsInputSchema,
          outputSchema: ExtractPaperQuestionsOutputSchema,
        },
        async input => {
          const MAX_RETRIES = 3;
          let lastError: string = '';

          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
              const response = await prompt(input);
              const output = response.output;

              if (!output) {
                throw new Error('No output received from AI model');
              }

              // Validate paper type index
              const paperTypeIndex = output.paperTypeIndex ?? -1;
              if (paperTypeIndex < 0 || paperTypeIndex >= paperTypes.length) {
                lastError = `Invalid paper type index: ${paperTypeIndex}. Must be between 0 and ${paperTypes.length - 1}.`;
                console.warn(`[Paper Extraction] Attempt ${attempt}/${MAX_RETRIES} - ${lastError}`);

                if (attempt < MAX_RETRIES) {
                  console.log(`[Paper Extraction] Retrying with paper type validation...`);
                  continue;
                }

                throw new Error(`Paper type determination failed after ${MAX_RETRIES} attempts. ${lastError}`);
              }

              // Validate paper type confidence
              const paperTypeConfidence = output.paperTypeConfidence ?? 0;
              if (paperTypeConfidence < 0 || paperTypeConfidence > 100) {
                lastError = `Invalid paper type confidence: ${paperTypeConfidence}. Must be between 0 and 100.`;
                console.warn(`[Paper Extraction] Attempt ${attempt}/${MAX_RETRIES} - ${lastError}`);

                if (attempt < MAX_RETRIES) {
                  console.log(`[Paper Extraction] Retrying with confidence validation...`);
                  continue;
                }

                throw new Error(`Paper type confidence validation failed after ${MAX_RETRIES} attempts. ${lastError}`);
              }

              // Validate year
              const year = output.year ?? 0;
              if (year < 1900 || year > 2100) {
                lastError = `Invalid year: ${year}. Must be between 1900 and 2100.`;
                console.warn(`[Paper Extraction] Attempt ${attempt}/${MAX_RETRIES} - ${lastError}`);

                if (attempt < MAX_RETRIES) {
                  console.log(`[Paper Extraction] Retrying with year correction...`);
                  continue;
                }

                throw new Error(`Year validation failed after ${MAX_RETRIES} attempts. ${lastError}`);
              }

              // Validate month
              const month = output.month ?? 0;
              if (month < 1 || month > 12) {
                lastError = `Invalid month: ${month}. Must be between 1 and 12.`;
                console.warn(`[Paper Extraction] Attempt ${attempt}/${MAX_RETRIES} - ${lastError}`);

                if (attempt < MAX_RETRIES) {
                  console.log(`[Paper Extraction] Retrying with month correction...`);
                  continue;
                }

                throw new Error(`Month validation failed after ${MAX_RETRIES} attempts. ${lastError}`);
              }

              // Validate questions array
              const questions = output.questions || [];
              if (questions.length === 0) {
                lastError = 'No questions extracted from paper.';
                console.warn(`[Paper Extraction] Attempt ${attempt}/${MAX_RETRIES} - ${lastError}`);

                if (attempt < MAX_RETRIES) {
                  console.log(`[Paper Extraction] Retrying question extraction...`);
                  continue;
                }

                throw new Error(`Question extraction failed after ${MAX_RETRIES} attempts. ${lastError}`);
              }

              // Validate each question structure
              const validatedQuestions = questions.map((q, index) => {
                // Validate summary
                if (!q.summary || q.summary.trim() === '') {
                  console.warn(`[Paper Extraction] Question ${q.questionNumber || index + 1} missing summary, generating default`);
                  const textPreview = q.questionText?.substring(0, 100) || 'Question';
                  q.summary = `Question text: ${textPreview}...`;
                }

                // Validate question number
                if (typeof q.questionNumber !== 'number' || q.questionNumber < 1) {
                  console.warn(`[Paper Extraction] Question at index ${index} has invalid questionNumber, using fallback`);
                  q.questionNumber = index + 1;
                }

                // Validate topic index
                if (typeof q.topicIndex !== 'number' || q.topicIndex < 0 || q.topicIndex >= topics.length) {
                  console.warn(`[Paper Extraction] Question ${q.questionNumber} has invalid topicIndex ${q.topicIndex}, must be 0-${topics.length - 1}`);
                  // Set to 0 as fallback with low confidence
                  q.topicIndex = 0;
                  q.categorizationConfidence = 30;
                  q.categorizationReasoning = 'Fallback categorization due to invalid topic index';
                }

                // Validate confidence score
                if (typeof q.categorizationConfidence !== 'number' || q.categorizationConfidence < 0 || q.categorizationConfidence > 100) {
                  console.warn(`[Paper Extraction] Question ${q.questionNumber} has invalid confidence ${q.categorizationConfidence}, using default 50`);
                  q.categorizationConfidence = 50;
                }

                // Validate reasoning
                if (!q.categorizationReasoning || q.categorizationReasoning.trim() === '') {
                  console.warn(`[Paper Extraction] Question ${q.questionNumber} missing categorization reasoning`);
                  q.categorizationReasoning = 'No reasoning provided';
                }

                return q;
              });

              console.log(`[Paper Extraction] ✓ Validation passed on attempt ${attempt}`);

              return {
                paperTypeIndex,
                paperTypeConfidence,
                paperTypeReasoning: output.paperTypeReasoning || 'No reasoning provided',
                year,
                month,
                questions: validatedQuestions
              };

            } catch (error: any) {
              if (attempt === MAX_RETRIES) {
                throw error;
              }
              console.warn(`[Paper Extraction] Attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`);
            }
          }

          throw new Error(`Extraction failed after ${MAX_RETRIES} attempts. Last error: ${lastError}`);
        }
      );

      return await flow({
        examPaperDataUri,
        paperTypes,
        topics,
      });
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    const monthPadded = result.month.toString().padStart(2, '0');
    const paperTypeName = paperTypes[result.paperTypeIndex]?.name || `Type ${result.paperTypeIndex}`;
    console.log(`[Paper Extraction] Completed in ${duration}s - Paper: ${result.year}-${monthPadded} "${paperTypeName}" (confidence: ${result.paperTypeConfidence}%), Questions: ${result.questions.length}`);

    // Log low confidence warnings
    if (result.paperTypeConfidence < 70) {
      console.warn(`[Paper Extraction] ⚠ Low paper type confidence (${result.paperTypeConfidence}%): ${result.paperTypeReasoning}`);
    }

    const lowConfidenceQuestions = result.questions.filter(q => q.categorizationConfidence < 70);
    if (lowConfidenceQuestions.length > 0) {
      console.warn(`[Paper Extraction] ⚠ ${lowConfidenceQuestions.length} question(s) with low categorization confidence (<70%)`);
    }

    return result;
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.error(`[Paper Extraction] Error after ${duration}s:`, error);
    throw error;
  }
}
