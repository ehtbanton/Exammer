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

const PaperTypeInfoSchema = z.object({
  name: z.string().describe('The name of the paper type.'),
});

const TopicInfoSchema = z.object({
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
  questionNumber: z.number().describe('The question number from the exam paper (e.g., 1, 2, 3, 4). For multi-part questions, use the main question number only.'),
  topicName: z.string().describe('The name of the topic this question belongs to from the provided topics list.'),
  questionText: z.string().describe('The complete text of the exam question, including all parts and sub-questions.'),
  summary: z.string().describe('A brief one-sentence summary of what this question is about.'),
});

const ExtractPaperQuestionsOutputSchema = z.object({
  paperTypeIndex: z.number().describe('The 0-based index of the paper type from the provided paperTypes array (e.g., 0 for first paper type, 1 for second).'),
  paperIdentifier: z.string().describe('A unique identifier for this specific exam paper extracted from the paper content (e.g., "2022 June", "Specimen 2023", "Sample Paper 1").'),
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
        prompt: `You are analyzing an exam paper to extract structured data. Please follow these instructions carefully to ensure consistency.

Task Overview:
1. Identify the paper type by examining the document header/title
2. Extract a standardized identifier for this specific exam
3. Extract all questions with their numbers and categorize by topic
4. Provide a brief summary for each question

Available Paper Types (0-indexed):
{{#each paperTypes}}
Index {{@index}}: {{name}}
{{/each}}

Available Topics:
{{#each topics}}
- {{name}}: {{description}}
{{/each}}

Exam Paper:
{{media url=examPaperDataUri}}

Instructions:

Step 1 - Paper Type Index:
Examine the paper's title or header to determine which paper type this is.
Output the 0-based index number from the paper types list above.
Example: If the paper says "Paper 2" and "Paper 2" appears at index 1 in the list, output paperTypeIndex: 1

Step 2 - Paper Identifier:
Extract a standardized identifier from the paper content itself (not the filename).
Use this exact format: "YYYY Month" for regular exams, or "Specimen YYYY" / "Sample YYYY" for specimen/sample papers.

Format examples:
- "2022 June" (for June 2022 exam)
- "2023 November" (for November 2023 exam)
- "Specimen 2024" (for 2024 specimen paper)
- "Sample 2023" (for 2023 sample paper)

Important: Always use the full 4-digit year. Use the month name, not numbers. Maintain this exact format for consistency with markschemes.

Step 3 - Question Numbers:
Extract the main question number as an integer (1, 2, 3, 4, etc.).
For questions with multiple parts (e.g., Question 1 has parts a, b, c), use the main number only (1).
Include all sub-parts in the questionText field.

Step 4 - Question Extraction:
For each question, provide:
- questionNumber: Integer (e.g., 1, 2, 3)
- topicName: The most relevant topic from the topics list (use exact name)
- questionText: Complete question including all parts
- summary: One-sentence description of what the question asks

Extract all questions from the paper.

Output Requirements:
- paperTypeIndex: Must be a valid index from the paper types list (0, 1, 2, etc.)
- paperIdentifier: Must follow the format "YYYY Month" or "Specimen YYYY"
- questions: Array of all questions with required fields`,
      });

      const flow = aiInstance.defineFlow(
        {
          name: 'extractPaperQuestionsFlow',
          inputSchema: ExtractPaperQuestionsInputSchema,
          outputSchema: ExtractPaperQuestionsOutputSchema,
        },
        async input => {
          const response = await prompt(input);
          const output = response.output;

          if (!output) {
            throw new Error('No output received from AI model');
          }

          // Validate required fields
          const paperTypeIndex = output.paperTypeIndex ?? -1;
          const paperIdentifier = output.paperIdentifier || 'Unknown';
          const questions = output.questions || [];

          if (paperTypeIndex < 0 || paperTypeIndex >= paperTypes.length) {
            console.warn(`[Paper Extraction] Invalid paperTypeIndex: ${paperTypeIndex}, defaulting to 0`);
          }

          // Validate each question
          const validatedQuestions = questions.map((q, index) => {
            if (!q.summary || q.summary.trim() === '') {
              console.warn(`[Paper Extraction] Question ${q.questionNumber} missing summary, generating default`);
              const textPreview = q.questionText?.substring(0, 100) || 'Question';
              return {
                ...q,
                summary: `Question about ${q.topicName || 'the topic'}: ${textPreview}...`
              };
            }
            if (typeof q.questionNumber !== 'number') {
              console.warn(`[Paper Extraction] Question at index ${index} has invalid questionNumber, using index`);
              return {
                ...q,
                questionNumber: index + 1
              };
            }
            return q;
          });

          return {
            paperTypeIndex: Math.max(0, Math.min(paperTypeIndex, paperTypes.length - 1)),
            paperIdentifier,
            questions: validatedQuestions
          };
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
