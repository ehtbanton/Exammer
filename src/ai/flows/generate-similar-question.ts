'use server';

/**
 * @fileOverview Generates a similar question variant based on an existing exam question.
 *
 * - generateSimilarQuestion - A function that creates a new question similar in structure and content.
 * - GenerateSimilarQuestionInput - The input type for the generateSimilarQuestion function.
 * - GenerateSimilarQuestionOutput - The return type for the generateSimilarQuestion function.
 */

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {z} from 'genkit';

const GenerateSimilarQuestionInputSchema = z.object({
  originalQuestionText: z.string().describe('The original exam question to base the variant on.'),
  topicName: z.string().describe('The name of the topic this question covers.'),
  topicDescription: z.string().describe('The description of what this topic covers.'),
});
export type GenerateSimilarQuestionInput = z.infer<typeof GenerateSimilarQuestionInputSchema>;

const GenerateSimilarQuestionOutputSchema = z.object({
  questionText: z.string().describe('The generated question variant that is similar but not identical to the original.'),
  summary: z.string().describe('A brief one-sentence summary of what this question variant is about.'),
});
export type GenerateSimilarQuestionOutput = z.infer<typeof GenerateSimilarQuestionOutputSchema>;

export async function generateSimilarQuestion(
  input: GenerateSimilarQuestionInput
): Promise<GenerateSimilarQuestionOutput> {
  const startTime = Date.now();
  console.log('[Process C] Starting similar question generation...');

  const ai = genkit({
    plugins: [googleAI()],
    model: 'googleai/gemini-2.5-flash',
  });

  const prompt = ai.definePrompt({
    name: 'generateSimilarQuestionPrompt',
    input: {schema: GenerateSimilarQuestionInputSchema},
    output: {schema: GenerateSimilarQuestionOutputSchema},
    prompt: `You are an expert educator creating practice exam questions for students.

Your task is to generate a NEW question that is SIMILAR to the original question provided, but NOT IDENTICAL.

Topic: {{topicName}}
Topic Description: {{topicDescription}}

Original Question:
{{originalQuestionText}}

Guidelines for generating the similar question:
1. MAINTAIN the same structure and format as the original (e.g., if it has parts a, b, c, keep that structure)
2. MAINTAIN the same difficulty level and assessment objectives
3. TEST the same concepts and skills from the topic
4. CHANGE the specific details, numbers, scenarios, or context to make it a unique variant
5. Ensure the question is realistic and could plausibly appear on an actual exam
6. Keep the same approximate length and complexity
7. If the original uses specific examples or scenarios, use DIFFERENT but equivalent examples
8. The question should feel like it's from the same exam paper but testing the same knowledge in a slightly different way

For example:
- If the original asks about photosynthesis in plants, the variant might ask about photosynthesis in algae
- If the original uses specific numbers (e.g., 50 cm), use different numbers (e.g., 75 cm)
- If the original describes a specific experimental setup, describe a similar but different setup
- If the original asks to "calculate X", the variant should also ask to "calculate X" but with different values

Generate a similar question that follows these guidelines.`,
  });

  const flow = ai.defineFlow(
    {
      name: 'generateSimilarQuestionFlow',
      inputSchema: GenerateSimilarQuestionInputSchema,
      outputSchema: GenerateSimilarQuestionOutputSchema,
    },
    async input => {
      const response = await prompt(input);
      const output = response.output;

      if (!output) {
        throw new Error('Failed to generate similar question - no output received');
      }

      return {
        questionText: output.questionText,
        summary: output.summary,
      };
    }
  );

  const result = await flow(input);

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  console.log(`[Process C] Similar question generated in ${duration}s`);

  return result;
}
