
'use server';

/**
 * @fileOverview Decomposes an exam syllabus PDF into a structured list of paper types and their corresponding topics.
 *
 * - decomposeSyllabus - A function that handles the syllabus decomposition process.
 * - DecomposeSyllabusInput - The input type for the decomposeSyllabus function.
 * - DecomposeSyllabusOutput - The return type for the decomposeSyllabus function.
 */

import {z} from 'genkit';
import {executeWithManagedKey} from '@/ai/genkit';

const DecomposeSyllabusInputSchema = z.object({
  syllabusDataUri: z
    .string()
    .describe(
      "An exam syllabus in PDF format, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
});
export type DecomposeSyllabusInput = z.infer<typeof DecomposeSyllabusInputSchema>;

const TopicSchema = z.object({
  name: z.string().describe('The name of the topic.'),
  description: z.string().describe('A brief 1-2 sentence description of what this topic covers.'),
});

const PaperTypeSchema = z.object({
  name: z.string().describe('The name of the paper type, e.g., "Paper 1: Core Principles".'),
  topics: z.array(TopicSchema).describe('A list of topics with their subsections covered in this paper type.'),
});

const DecomposeSyllabusOutputSchema = z.object({
  subjectName: z.string().describe('The name of the subject/course as identified from the syllabus.'),
  paperTypes: z.array(PaperTypeSchema).describe('A list of paper types and their topics derived from the syllabus.'),
});
export type DecomposeSyllabusOutput = z.infer<typeof DecomposeSyllabusOutputSchema>;

export async function decomposeSyllabus(
  input: DecomposeSyllabusInput
): Promise<DecomposeSyllabusOutput> {
  const startTime = Date.now();
  console.log('[Syllabus Processing] Started decomposing syllabus...');

  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Use the global API key manager to execute this flow
      const result = await executeWithManagedKey(async (ai, flowInput) => {
        const prompt = ai.definePrompt({
          name: 'decomposeSyllabusPrompt',
          input: {schema: DecomposeSyllabusInputSchema},
          output: {schema: DecomposeSyllabusOutputSchema},
          prompt: `Extract the structure from this exam syllabus:

1. Subject name
2. Paper types (e.g., "Paper 1", "Paper 2")
3. For each paper type, list the topics covered
4. For each topic, write a brief 1-2 sentence description

Syllabus: {{media url=syllabusDataUri}}

Keep descriptions concise - just enough to categorize exam questions later.`,
        });

        const response = await prompt(flowInput, {
          model: 'googleai/gemini-3-flash-preview',
        });
        const output = response.output;

        // Ensure that the output always has required fields.
        const subjectName = output?.subjectName ?? 'Untitled Subject';
        const paperTypes = output?.paperTypes ?? [];

        return { subjectName, paperTypes };
      }, input);

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      console.log(`[Syllabus Processing] Completed in ${duration}s`);
      console.log(`[Syllabus Processing] Found ${result.paperTypes.length} paper type(s) with ${result.paperTypes.reduce((acc, pt) => acc + pt.topics.length, 0)} total topics`);

      return result;
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message || String(error);

      console.error(`[Syllabus Processing] ⚠ Attempt ${attempt}/${MAX_RETRIES} failed:`, errorMessage);

      // Check if it's a "No valid candidates" error
      if (errorMessage.includes('No valid candidates') || errorMessage.includes('FAILED_PRECONDITION')) {
        if (attempt < MAX_RETRIES) {
          console.log(`[Syllabus Processing] Retrying in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        } else {
          // On final attempt, throw a more helpful error
          throw new Error(
            'Failed to process syllabus after multiple attempts. This may be due to: ' +
            '(1) Content safety filters blocking the response, ' +
            '(2) Invalid or corrupted PDF file, or ' +
            '(3) Temporary API issues. Please try with a different PDF or try again later.'
          );
        }
      }

      // For other errors, rethrow immediately
      throw error;
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Unknown error during syllabus processing');
}
