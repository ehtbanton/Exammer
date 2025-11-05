'use server';

/**
 * @fileOverview Extracts questions from a single exam paper without markscheme processing.
 *
 * This flow is part of the redesigned parallel extraction workflow where papers and
 * markschemes are processed separately and then matched mechanically.
 */

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {z} from 'genkit';
import {geminiApiKeyManager} from '@root/gemini-api-key-manager';
import {
  isValidPaperIdentifier,
  getPaperIdentifierErrorMessage,
  getPaperIdentifierPromptRules,
  getPaperQuestionIdPromptRules
} from './paper-identifier-validation';

const PaperTypeInfoSchema = z.object({
  name: z.string().describe('The name of the paper type.'),
});

const TopicInfoSchema = z.object({
  id: z.string().describe('The unique ID of the topic.'),
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
    .describe('The list of paper types from the syllabus (ordered array).'),
  topics: z
    .array(TopicInfoSchema)
    .describe('The list of topics from the syllabus to categorize questions into.'),
});
export type ExtractPaperQuestionsInput = z.infer<typeof ExtractPaperQuestionsInputSchema>;

const PaperQuestionSchema = z.object({
  questionId: z.string().describe('Question identifier in YYYY-MM-P-Q-T format (e.g., "2022-06-1-1-0" for June 2022, Paper 1, Question 1, Topic 0).'),
  questionText: z.string().describe('The complete text of the exam question, including all parts and sub-questions.'),
  summary: z.string().describe('A brief one-sentence summary of what this question is about.'),
});

const ExtractPaperQuestionsOutputSchema = z.object({
  paperTypeIndex: z.number().describe('The 0-based index of the paper type from the provided paperTypes array (e.g., 0 for first paper type, 1 for second).'),
  paperIdentifier: z.string().describe('Paper date in YYYY-MM-P format where YYYY=year, MM=month (01-12), P=paper type index. Example: "2022-06-1" for June 2022, Paper Type 1.'),
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
        prompt: `TASK: Extract questions from dated exam paper.

PAPER TYPES (0-indexed):
{{#each paperTypes}}
{{@index}}: {{name}}
{{/each}}

TOPICS (0-indexed):
{{#each topics}}
{{@index}}: {{name}} - {{description}}
{{/each}}

DOCUMENT:
{{media url=examPaperDataUri}}

EXTRACTION REQUIREMENTS:

1. PAPER DATE
   ${getPaperIdentifierPromptRules()}

   Steps:
   - Locate year in document (4 digits)
   - Locate month in document (convert to 2-digit: 01-12)
   - Identify paper type from header (use 0-based index)
   - Format as: YYYY-MM-P

   Example: Document shows "June 2022" and "Paper 2" (index 1) → Paper date: "2022-06-1"

2. QUESTION IDs
   ${getPaperQuestionIdPromptRules()}

   Construction steps:
   - Take paper date from step 1 (YYYY-MM-P)
   - Append question number (1, 2, 3, etc.)
   - Identify topic from topics list (use 0-based index)
   - Append topic index
   - For multi-part questions (1a, 1b), use main number only

   Example: Paper date "2022-06-1", Question 3, Topic 5 → Question ID: "2022-06-1-3-5"

3. FOR EACH QUESTION OUTPUT:
   - questionId: YYYY-MM-P-Q-T format (atomic string with topic index)
   - questionText: Complete text including all sub-parts
   - summary: Single sentence description

OUTPUT STRUCTURE:
{
  "paperTypeIndex": <integer 0-9>,
  "paperIdentifier": "<YYYY-MM-P>",
  "questions": [
    {
      "questionId": "<YYYY-MM-P-Q-T>",
      "questionText": "<complete text>",
      "summary": "<single sentence>"
    }
  ]
}

CRITICAL: Each questionId must include topic index as 5th field. Topic index must match position in topics list (0-based).`,
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

              // Validate paper identifier format (STRICT)
              const paperIdentifier = output.paperIdentifier || '';
              if (!isValidPaperIdentifier(paperIdentifier)) {
                lastError = getPaperIdentifierErrorMessage(paperIdentifier);
                console.warn(`[Paper Extraction] Attempt ${attempt}/${MAX_RETRIES} - ${lastError}`);

                if (attempt < MAX_RETRIES) {
                  // Re-prompt with error feedback
                  console.log(`[Paper Extraction] Retrying with format correction...`);
                  continue;
                }

                throw new Error(`Paper identifier validation failed after ${MAX_RETRIES} attempts. ${lastError}`);
              }

              // Validate paper type index
              const paperTypeIndex = output.paperTypeIndex ?? -1;
              if (paperTypeIndex < 0 || paperTypeIndex >= paperTypes.length) {
                lastError = `Invalid paperTypeIndex: ${paperTypeIndex}. Must be between 0 and ${paperTypes.length - 1}.`;
                console.warn(`[Paper Extraction] Attempt ${attempt}/${MAX_RETRIES} - ${lastError}`);

                if (attempt < MAX_RETRIES) {
                  console.log(`[Paper Extraction] Retrying with index correction...`);
                  continue;
                }

                throw new Error(`Paper type index validation failed after ${MAX_RETRIES} attempts. ${lastError}`);
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
                if (!q.summary || q.summary.trim() === '') {
                  console.warn(`[Paper Extraction] Question ${q.questionId} missing summary, generating default`);
                  const textPreview = q.questionText?.substring(0, 100) || 'Question';
                  return {
                    ...q,
                    summary: `Question text: ${textPreview}...`
                  };
                }
                if (!q.questionId || typeof q.questionId !== 'string') {
                  console.warn(`[Paper Extraction] Question at index ${index} has invalid questionId`);
                  const fallbackId = `${paperIdentifier}-${index + 1}-0`;
                  return {
                    ...q,
                    questionId: fallbackId
                  };
                }
                // Validate questionId format: must have 5 parts (YYYY-MM-P-Q-T)
                const parts = q.questionId.split('-');
                if (parts.length !== 5) {
                  console.warn(`[Paper Extraction] Question ID ${q.questionId} missing topic index (expected 5 parts, got ${parts.length})`);
                }
                // Validate questionId starts with paperIdentifier
                if (!q.questionId.startsWith(paperIdentifier + '-')) {
                  console.warn(`[Paper Extraction] Question ID ${q.questionId} does not match paper date ${paperIdentifier}`);
                }
                return q;
              });

              console.log(`[Paper Extraction] ✓ Validation passed on attempt ${attempt}`);

              return {
                paperTypeIndex,
                paperIdentifier,
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
    console.log(`[Paper Extraction] Completed in ${duration}s - Paper: ${result.paperIdentifier}, Type Index: ${result.paperTypeIndex}, Questions: ${result.questions.length}`);

    return result;
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.error(`[Paper Extraction] Error after ${duration}s:`, error);
    throw error;
  }
}
