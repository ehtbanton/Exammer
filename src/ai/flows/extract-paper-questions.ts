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
  questionNumber: z.number().describe('The question number from the exam paper (e.g., 1, 2, 3). For multi-part questions, use only the main number.'),
  questionText: z.string().describe('The complete text of the exam question, including all parts and sub-questions.'),
  summary: z.string().describe('A brief one-sentence summary of what this question is about.'),
  topicName: z.string().describe('The name of the topic this question belongs to, chosen from the provided topics list.'),
});

const ExtractPaperQuestionsOutputSchema = z.object({
  paperTypeName: z.string().describe('The name of the paper type identified from the exam paper header/title (e.g., "Paper 1", "Paper 2"). Must match one from the provided paperTypes list.'),
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
        prompt: `TASK: Extract questions from dated exam paper.

PAPER TYPES:
{{#each paperTypes}}
- {{name}}
{{/each}}

TOPICS:
{{#each topics}}
- {{name}}: {{description}}
{{/each}}

DOCUMENT:
{{media url=examPaperDataUri}}

EXTRACTION REQUIREMENTS:

1. PAPER IDENTIFICATION
   Steps:
   - Locate year in document (4 digits, e.g., 2022)
   - Locate month in document (as number 1-12, e.g., 6 for June)
   - Identify paper type name from header (must match one from PAPER TYPES list above)

   Example: Document shows "June 2022" and "Paper 2" → year: 2022, month: 6, paperTypeName: "Paper 2"

2. QUESTION IDs

   For now, just identify the question number (1, 2, 3, etc.).
   The full question ID will be constructed later during processing.
   For multi-part questions (1a, 1b), use the main number only.

   Example: Question 3 with parts a, b, c → Question number: 3

   Note: Paper type and topic will be matched later, not in the question ID at this stage.

   QUESTION NUMBER IDENTIFICATION PROCEDURE:

   To correctly identify question numbers in the document, follow this protocol:

   a) Locate question markers in the document:
      - Standard formats: "Question 1", "Question 2", "Q1", "Q2", "Q.1", "Q.2"
      - Numeric formats: "1.", "2)", "3." at the start of content blocks
      - Visual emphasis: Numbers in bold or larger font preceding question content

   b) Distinguish question numbers from other numeric elements:
      - Page numbers (typically in headers, footers, or page corners) are NOT question numbers
      - Section headers ("Section A", "Part I", "Part II") are NOT question numbers
      - Mark allocations ("[3 marks]", "(5 marks)", "[Total: 20]") are NOT question numbers
      - Years and dates ("2023", "June 2022") are NOT question numbers

   c) Handle multi-part questions:
      - Treat "1a", "1(a)", "1 (a)", "1(i)", "1 i" as sub-parts of Question 1
      - Combine all sub-parts into a single question using the main number only
      - Extract the complete text including all sub-parts

   d) Validate sequential numbering:
      - Questions should be numbered consecutively: 1, 2, 3, 4, 5, etc.
      - Typical exam papers contain 5-15 questions
      - If numbering contains gaps or appears incorrect, re-examine the document

   e) Structural patterns in exam papers:
      - Questions appear in numerical order
      - Each question has substantial content (not just a number)
      - Questions typically begin on a new line with clear spacing
      - Formatting is consistent across all questions

3. FOR EACH QUESTION OUTPUT:
   - questionNumber: Just the number (e.g., 1, 2, 3)
   - questionText: Complete text including all sub-parts
   - summary: Single sentence description
   - topicName: The name of the topic this question belongs to (must match one from the TOPICS list)

VALIDATION REQUIREMENTS:

Before generating output, verify the following:
- Question numbers are sequential without gaps (1, 2, 3, 4...)
- Total question count is within expected range (typically 5-15 questions)
- Each question has substantial content (not just a number)
- Multi-part questions (1a, 1b, 1c) are combined under a single main number
- No page numbers, section labels, or mark allocations were misidentified as questions

OUTPUT STRUCTURE:
{
  "paperTypeName": "<name from PAPER TYPES list>",
  "year": <4-digit year>,
  "month": <1-12>,
  "questions": [
    {
      "questionNumber": <integer>,
      "questionText": "<complete text>",
      "summary": "<single sentence>",
      "topicName": "<topic name from TOPICS list>"
    }
  ]
}

CRITICAL:
- paperTypeName must match one of the paper type names from the PAPER TYPES list provided above
- Each topicName must match one of the topic names from the TOPICS list provided above
- If a question spans multiple topics, choose the primary/most relevant topic`,
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

              // Validate paper type name
              const paperTypeName = output.paperTypeName || '';
              if (!paperTypeName.trim()) {
                lastError = 'Missing paper type name.';
                console.warn(`[Paper Extraction] Attempt ${attempt}/${MAX_RETRIES} - ${lastError}`);

                if (attempt < MAX_RETRIES) {
                  console.log(`[Paper Extraction] Retrying with paper type identification...`);
                  continue;
                }

                throw new Error(`Paper type identification failed after ${MAX_RETRIES} attempts. ${lastError}`);
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
                  return {
                    ...q,
                    summary: `Question text: ${textPreview}...`
                  };
                }

                // Validate question number
                if (typeof q.questionNumber !== 'number' || q.questionNumber < 1) {
                  console.warn(`[Paper Extraction] Question at index ${index} has invalid questionNumber, using fallback`);
                  return {
                    ...q,
                    questionNumber: index + 1
                  };
                }

                // Validate topicName is provided
                if (!q.topicName || typeof q.topicName !== 'string' || q.topicName.trim() === '') {
                  console.warn(`[Paper Extraction] Question ${q.questionNumber} missing topic name`);
                }

                return q;
              });

              console.log(`[Paper Extraction] ✓ Validation passed on attempt ${attempt}`);

              return {
                paperTypeName,
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
    console.log(`[Paper Extraction] Completed in ${duration}s - Paper: ${result.year}-${monthPadded} "${result.paperTypeName}", Questions: ${result.questions.length}`);

    return result;
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.error(`[Paper Extraction] Error after ${duration}s:`, error);
    throw error;
  }
}
