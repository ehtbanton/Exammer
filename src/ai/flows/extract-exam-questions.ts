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
 */
const BATCH_SIZE = 10; // Process 10 papers per batch
const MAX_PARALLEL_BATCHES_PER_KEY = 10; // Process up to 10 batches in parallel per API key
const MAX_REQUESTS_PER_MINUTE_PER_KEY = 10; // Rate limit: 10 requests per minute per API key

/**
 * API Key manager with rate limiting and round-robin distribution
 */
class ApiKeyManager {
  private apiKeys: string[];
  private keyTimers: Map<string, number> = new Map(); // Tracks when each key can next be used
  private keyRequestCounts: Map<string, number> = new Map(); // Tracks requests made in current window
  private currentKeyIndex: number = 0; // Round-robin index
  private keyLock: Promise<void> = Promise.resolve(); // Ensures atomic key selection

  constructor(apiKeys: string[]) {
    this.apiKeys = apiKeys;
    console.log(`Initialized API Key Manager with ${apiKeys.length} keys`);
  }

  /**
   * Get an available API key, respecting rate limits and rotating through keys
   */
  async getAvailableKey(): Promise<{key: string, index: number}> {
    // Wait for any previous key selection to complete (makes selection atomic)
    await this.keyLock;

    // Create a new lock for this selection
    let releaseLock: () => void;
    this.keyLock = new Promise(resolve => {
      releaseLock = resolve;
    });

    try {
      const now = Date.now();
      const startIndex = this.currentKeyIndex;

      // Try each key in round-robin order
      for (let attempts = 0; attempts < this.apiKeys.length; attempts++) {
        const key = this.apiKeys[this.currentKeyIndex];
        const nextAvailable = this.keyTimers.get(key) || 0;
        const requestCount = this.keyRequestCounts.get(key) || 0;

        if (now >= nextAvailable && requestCount < MAX_REQUESTS_PER_MINUTE_PER_KEY) {
          const keyIndex = this.currentKeyIndex;
          // Move to next key for next request
          this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;

          // Mark request immediately while we have the lock
          this.markRequestStart(key);

          return {key, index: keyIndex + 1};
        }

        // Try next key
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
      }

      // If no key is immediately available, wait for the soonest one
      const soonestAvailable = Math.min(
        ...this.apiKeys.map(key => this.keyTimers.get(key) || 0)
      );

      const waitTime = Math.max(0, soonestAvailable - now);
      if (waitTime > 0) {
        console.log(`Rate limit: All keys busy, waiting ${waitTime}ms...`);
        releaseLock!(); // Release lock before waiting
        await new Promise(resolve => setTimeout(resolve, waitTime));
        // Recursively try again
        return this.getAvailableKey();
      }

      // Reset index to start and try again
      this.currentKeyIndex = startIndex;
      releaseLock!(); // Release lock before recursing
      return this.getAvailableKey();
    } finally {
      // Ensure lock is released
      releaseLock!();
    }
  }

  /**
   * Mark that a request is being made with this key
   */
  private markRequestStart(apiKey: string) {
    const requestCount = (this.keyRequestCounts.get(apiKey) || 0) + 1;
    this.keyRequestCounts.set(apiKey, requestCount);

    // If this is the first request, set a timer to reset the count after 1 minute
    if (requestCount === 1) {
      setTimeout(() => {
        this.keyRequestCounts.set(apiKey, 0);
        console.log(`Rate limit reset for API key ${this.getKeyIndex(apiKey)}`);
      }, 60000); // 1 minute
    }

    // If we've hit the limit, set the next available time to 1 minute from now
    if (requestCount >= MAX_REQUESTS_PER_MINUTE_PER_KEY) {
      this.keyTimers.set(apiKey, Date.now() + 60000);
      console.log(`API key ${this.getKeyIndex(apiKey)} hit rate limit (${requestCount}/${MAX_REQUESTS_PER_MINUTE_PER_KEY})`);
    }
  }

  private getKeyIndex(apiKey: string): number {
    return this.apiKeys.indexOf(apiKey) + 1;
  }

  /**
   * Get all API keys for parallel processing
   */
  getAllKeys(): string[] {
    return this.apiKeys;
  }
}

export async function extractExamQuestions(
  input: ExtractExamQuestionsInput
): Promise<ExtractExamQuestionsOutput> {
  const { examPapersDataUris, topics } = input;

  // Get parallel API keys from environment
  const parallelKeysJson = process.env.GEMINI_API_KEYS_PARALLEL;
  if (!parallelKeysJson) {
    throw new Error('GEMINI_API_KEYS_PARALLEL environment variable not set');
  }

  let parallelApiKeys: string[];
  try {
    parallelApiKeys = JSON.parse(parallelKeysJson);
    if (!Array.isArray(parallelApiKeys) || parallelApiKeys.length === 0) {
      throw new Error('GEMINI_API_KEYS_PARALLEL must be a non-empty array');
    }
  } catch (error) {
    throw new Error(`Failed to parse GEMINI_API_KEYS_PARALLEL: ${error}`);
  }

  console.log(`Processing ${examPapersDataUris.length} papers using ${parallelApiKeys.length} API keys...`);

  // Split papers into batches
  const batches: string[][] = [];
  for (let i = 0; i < examPapersDataUris.length; i += BATCH_SIZE) {
    batches.push(examPapersDataUris.slice(i, i + BATCH_SIZE));
  }

  console.log(`Created ${batches.length} batches of ${BATCH_SIZE} papers each`);

  // Initialize API key manager
  const keyManager = new ApiKeyManager(parallelApiKeys);

  // Process all batches with rate limiting
  const allQuestions: ExtractExamQuestionsOutput['questions'] = [];
  const batchPromises: Promise<ExtractExamQuestionsOutput['questions']>[] = [];

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    // Create a promise for this batch
    const batchPromise = (async () => {
      // Get an available API key (waits if necessary, marks request atomically)
      const {key: apiKey, index: keyIndex} = await keyManager.getAvailableKey();

      console.log(`Batch ${batchIndex + 1}/${batches.length}: Using API key ${keyIndex}, processing ${batch.length} papers...`);

      try {
        // Create a genkit instance with this specific API key
        const aiInstance = genkit({
          plugins: [googleAI({ apiKey })],
          model: 'googleai/gemini-2.5-flash',
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

        const result = await flow({
          examPapersDataUris: batch,
          topics,
        });

        console.log(`Batch ${batchIndex + 1}/${batches.length}: Extracted ${result.questions.length} questions`);
        return result.questions;
      } catch (error) {
        console.error(`Batch ${batchIndex + 1}/${batches.length}: Error:`, error);
        return [];
      }
    })();

    batchPromises.push(batchPromise);

    // Control parallelism: only allow MAX_PARALLEL_BATCHES_PER_KEY * number of keys to run at once
    const maxConcurrent = MAX_PARALLEL_BATCHES_PER_KEY * parallelApiKeys.length;
    if (batchPromises.length >= maxConcurrent) {
      // Wait for at least one to complete before continuing
      const results = await Promise.race(batchPromises.map((p, i) => p.then(r => ({ index: i, result: r }))));
      allQuestions.push(...results.result);
      batchPromises.splice(results.index, 1);
    }
  }

  // Wait for all remaining batches to complete
  const remainingResults = await Promise.all(batchPromises);
  allQuestions.push(...remainingResults.flat());

  console.log(`Total questions extracted: ${allQuestions.length}`);

  return { questions: allQuestions };
}
