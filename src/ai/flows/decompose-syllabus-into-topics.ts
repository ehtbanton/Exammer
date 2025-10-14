'use server';

/**
 * @fileOverview Decomposes an exam syllabus PDF into a structured list of manageable topics using AI.
 *
 * - decomposeSyllabusIntoTopics - A function that handles the syllabus decomposition process.
 * - DecomposeSyllabusIntoTopicsInput - The input type for the decomposeSyllabusIntoTopics function.
 * - DecomposeSyllabusIntoTopicsOutput - The return type for the decomposeSyllabusIntoTopics function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DecomposeSyllabusIntoTopicsInputSchema = z.object({
  syllabusDataUri: z
    .string()
    .describe(
      "An exam syllabus in PDF format, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
});
export type DecomposeSyllabusIntoTopicsInput = z.infer<typeof DecomposeSyllabusIntoTopicsInputSchema>;

const DecomposeSyllabusIntoTopicsOutputSchema = z.object({
  topics: z.array(z.string()).describe('A list of manageable topics derived from the syllabus.'),
});
export type DecomposeSyllabusIntoTopicsOutput = z.infer<typeof DecomposeSyllabusIntoTopicsOutputSchema>;

export async function decomposeSyllabusIntoTopics(
  input: DecomposeSyllabusIntoTopicsInput
): Promise<DecomposeSyllabusIntoTopicsOutput> {
  return decomposeSyllabusIntoTopicsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'decomposeSyllabusIntoTopicsPrompt',
  input: {schema: DecomposeSyllabusIntoTopicsInputSchema},
  output: {schema: DecomposeSyllabusIntoTopicsOutputSchema},
  prompt: `You are an expert educator. Please read this syllabus and create a list of topics from it.\n\nSyllabus: {{media url=syllabusDataUri}}\n\nTopics: `,
});

const decomposeSyllabusIntoTopicsFlow = ai.defineFlow(
  {
    name: 'decomposeSyllabusIntoTopicsFlow',
    inputSchema: DecomposeSyllabusIntoTopicsInputSchema,
    outputSchema: DecomposeSyllabusIntoTopicsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
