'use server';

/**
 * @fileOverview Extracts and categorizes exam questions from uploaded past papers into topics.
 *
 * - extractExamQuestions - A function that extracts discrete exam questions and sorts them into topics.
 * - ExtractExamQuestionsInput - The input type for the extractExamQuestions function.
 * - ExtractExamQuestionsOutput - The return type for the extractExamQuestions function.
 */

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {z} from 'genkit';
import {geminiApiKeyManager} from '@root/gemini-api-key-manager';

const TopicInfoSchema = z.object({
  name: z.string().describe('The name of the topic.'),
  description: z.string().describe('The description of what this topic covers.'),
});

const ExtractExamQuestionsInputSchema = z.object({
  examPapersDataUris: z
    .array(z.string())
    .describe(
      "An array of exam papers in PDF format, as data URIs that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
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
  questions: z.array(ExamQuestionSchema).describe('A list of all discrete exam questions extracted and categorized by topic.'),
});
export type ExtractExamQuestionsOutput = z.infer<typeof ExtractExamQuestionsOutputSchema>;

/**
 * Configuration for batch processing
 * BATCH_SIZE controls how many papers are processed in a single API call
 */
const BATCH_SIZE = 5; // Number of papers to send in a single API call
const REQUEST_START_DELAY_MS = 50; // Small delay between starting requests to avoid thundering herd

export async function extractExamQuestions(
  input: ExtractExamQuestionsInput
): Promise<ExtractExamQuestionsOutput> {
  const { examPapersDataUris, topics } = input;

  // Get the number of API keys from the global manager
  const numKeys = geminiApiKeyManager.getKeyCount();
  console.log(`Processing ${examPapersDataUris.length} papers using ${numKeys} API key(s)...`);

  // Split papers into batches
  const batches: string[][] = [];
  for (let i = 0; i < examPapersDataUris.length; i += BATCH_SIZE) {
    batches.push(examPapersDataUris.slice(i, i + BATCH_SIZE));
  }

  console.log(`Created ${batches.length} batches of ${BATCH_SIZE} papers each`);

  // Process all batches using the global API key manager
  const allQuestions: ExtractExamQuestionsOutput['questions'] = [];
  const batchPromises: Promise<ExtractExamQuestionsOutput['questions']>[] = [];

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    // Add pacing delay to avoid burst limits (except for first request)
    if (batchIndex > 0) {
      await new Promise(resolve => setTimeout(resolve, REQUEST_START_DELAY_MS));
    }

    // Create a promise for this batch
    const batchPromise = (async () => {
      const batchStartTime = Date.now();
      console.log(`[Question Extraction] Batch ${batchIndex + 1}/${batches.length}: Starting, processing ${batch.length} papers...`);

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
            name: `extractExamQuestionsPrompt-${batchIndex}`,
            input: {schema: ExtractExamQuestionsInputSchema},
            output: {schema: ExtractExamQuestionsOutputSchema},
            prompt: `You are an expert educator analyzing past exam papers to help students prepare for their exams.

Your task is to:
1. Read through all the provided exam papers
2. Extract each discrete, complete exam question (including all parts like a, b, c, etc.)
3. For each question, write a brief one-sentence summary
4. Categorize each question into the most appropriate topic from the provided list

Topics available for categorization:
{{#each topics}}
- {{name}}: {{description}}
{{/each}}

Exam Papers:
{{#each examPapersDataUris}}
{{media url=this}}
{{/each}}

Important guidelines:
- Each question should be complete and standalone
- If a question has multiple parts (a, b, c), include all parts in the questionText
- The summary should be concise but informative (one sentence)
- Match each question to the most relevant topic based on the topic descriptions
- If a question spans multiple topics, choose the primary/most relevant topic
- Extract ALL questions from ALL papers provided`,
          });

          const flow = aiInstance.defineFlow(
            {
              name: `extractExamQuestionsFlow-${batchIndex}`,
              inputSchema: ExtractExamQuestionsInputSchema,
              outputSchema: ExtractExamQuestionsOutputSchema,
            },
            async input => {
              const response = await prompt(input);
              const output = response.output;
              const questions = output?.questions ?? [];
              return { questions };
            }
          );

          return await flow({
            examPapersDataUris: batch,
            topics,
          });
        });

        const batchEndTime = Date.now();
        const batchDuration = ((batchEndTime - batchStartTime) / 1000).toFixed(2);
        console.log(`[Question Extraction] Batch ${batchIndex + 1}/${batches.length}: Completed in ${batchDuration}s - Extracted ${result.questions.length} questions`);
        return result.questions;
      } catch (error) {
        const batchEndTime = Date.now();
        const batchDuration = ((batchEndTime - batchStartTime) / 1000).toFixed(2);
        console.error(`[Question Extraction] Batch ${batchIndex + 1}/${batches.length}: Error after ${batchDuration}s:`, error);
        return [];
      }
    })();

    batchPromises.push(batchPromise);
  }

  // Wait for all batches to complete
  const allResults = await Promise.all(batchPromises);
  allQuestions.push(...allResults.flat());

  console.log(`Total questions extracted: ${allQuestions.length}`);

  return { questions: allQuestions };
}
