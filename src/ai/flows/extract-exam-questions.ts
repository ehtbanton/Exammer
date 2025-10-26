'use server';

/**
 * @fileOverview Extracts and categorizes exam questions from a single exam paper.
 *
 * - extractExamQuestions - A function that determines the paper type from the exam title and extracts discrete exam questions, sorting them into topics.
 * - ExtractExamQuestionsInput - The input type for the extractExamQuestions function.
 * - ExtractExamQuestionsOutput - The return type for the extractExamQuestions function, including the determined paper type name.
 */

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {z} from 'genkit';
import {geminiApiKeyManager} from '@root/gemini-api-key-manager';

const TopicInfoSchema = z.object({
  name: z.string().describe('The name of the topic.'),
  description: z.string().describe('The description of what this topic covers.'),
});

const PaperTypeInfoSchema = z.object({
  name: z.string().describe('The name of the paper type.'),
});

const ExtractExamQuestionsInputSchema = z.object({
  examPaperDataUri: z
    .string()
    .describe(
      "A single exam paper in PDF format, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
  paperTypes: z
    .array(PaperTypeInfoSchema)
    .describe('The list of paper types from the syllabus that this exam paper could belong to.'),
  topics: z
    .array(TopicInfoSchema)
    .describe('The list of topics from the syllabus to categorize questions into.'),
});
export type ExtractExamQuestionsInput = z.infer<typeof ExtractExamQuestionsInputSchema>;

const ExamQuestionSchema = z.object({
  questionText: z.string().describe('The complete text of the exam question, including all parts and sub-questions.'),
  summary: z.string().describe('A brief one-sentence summary of what this question is about.'),
  topicName: z.string().describe('The name of the topic this question belongs to.'),
});

const ExtractExamQuestionsOutputSchema = z.object({
  paperTypeName: z.string().describe('The name of the paper type that this exam paper belongs to, determined from the exam paper title.'),
  questions: z.array(ExamQuestionSchema).describe('A list of all discrete exam questions extracted and categorized by topic.'),
});
export type ExtractExamQuestionsOutput = z.infer<typeof ExtractExamQuestionsOutputSchema>;

export async function extractExamQuestions(
  input: ExtractExamQuestionsInput
): Promise<ExtractExamQuestionsOutput> {
  const { examPaperDataUri, paperTypes, topics } = input;

  console.log(`[Question Extraction] Processing single exam paper...`);

  const startTime = Date.now();

  try {
    // Use the global API key manager to execute with a managed key
    const result = await geminiApiKeyManager.withKey(async (apiKey) => {
      // Create a genkit instance with this specific API key
      const aiInstance = genkit({
        plugins: [googleAI({ apiKey })],
        model: 'googleai/gemini-2.5-flash-lite',
      });

      // Create flow with this AI instance
      const prompt = aiInstance.definePrompt({
        name: 'extractExamQuestionsPrompt',
        input: {schema: ExtractExamQuestionsInputSchema},
        output: {schema: ExtractExamQuestionsOutputSchema},
        prompt: `You are an expert educator analyzing a past exam paper to help students prepare for their exams.

Your task is to:
1. Determine which paper type this exam paper belongs to by examining the exam paper title/header
2. Extract each discrete, complete exam question (including all parts like a, b, c, etc.)
3. For each question, write a brief one-sentence summary
4. Categorize each question into the most appropriate topic from the provided list

Available paper types:
{{#each paperTypes}}
- {{name}}
{{/each}}

Topics available for categorization:
{{#each topics}}
- {{name}}: {{description}}
{{/each}}

Exam Paper:
{{media url=examPaperDataUri}}

Important guidelines:
- Identify the paper type from the exam paper title (e.g., "Paper 1", "Paper 2", "Advanced Paper")
- Each question should be complete and standalone
- If a question has multiple parts (a, b, c), include all parts in the questionText
- The summary should be concise but informative (one sentence)
- Match each question to the most relevant topic based on the topic descriptions
- If a question spans multiple topics, choose the primary/most relevant topic
- Extract ALL questions from the provided exam paper`,
      });

      const flow = aiInstance.defineFlow(
        {
          name: 'extractExamQuestionsFlow',
          inputSchema: ExtractExamQuestionsInputSchema,
          outputSchema: ExtractExamQuestionsOutputSchema,
        },
        async input => {
          const response = await prompt(input);
          const output = response.output;
          const paperTypeName = output?.paperTypeName ?? 'Unknown';
          const questions = output?.questions ?? [];
          return { paperTypeName, questions };
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
    console.log(`[Question Extraction] Completed in ${duration}s - Paper Type: ${result.paperTypeName}, Extracted ${result.questions.length} questions`);

    return result;
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.error(`[Question Extraction] Error after ${duration}s:`, error);
    throw error;
  }
}
