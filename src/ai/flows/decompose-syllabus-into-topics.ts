'use server';

/**
 * @fileOverview Decomposes an exam syllabus PDF into a structured list of paper types and their corresponding topics.
 *
 * - decomposeSyllabus - A function that handles the syllabus decomposition process.
 * - DecomposeSyllabusInput - The input type for the decomposeSyllabus function.
 * - DecomposeSyllabusOutput - The return type for the decomposeSyllabus function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DecomposeSyllabusInputSchema = z.object({
  syllabusDataUri: z
    .string()
    .describe(
      "An exam syllabus in PDF format, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
});
export type DecomposeSyllabusInput = z.infer<typeof DecomposeSyllabusInputSchema>;

const PaperTypeSchema = z.object({
  name: z.string().describe('The name of the paper type, e.g., "Paper 1: Core Principles".'),
  topics: z.array(z.string()).describe('A list of topics covered in this paper type.'),
});

const DecomposeSyllabusOutputSchema = z.object({
  paperTypes: z.array(PaperTypeSchema).describe('A list of paper types and their topics derived from the syllabus.'),
});
export type DecomposeSyllabusOutput = z.infer<typeof DecomposeSyllabusOutputSchema>;

export async function decomposeSyllabus(
  input: DecomposeSyllabusInput
): Promise<DecomposeSyllabusOutput> {
  return decomposeSyllabusFlow(input);
}

const prompt = ai.definePrompt({
  name: 'decomposeSyllabusPrompt',
  input: {schema: DecomposeSyllabusInputSchema},
  output: {schema: DecomposeSyllabusOutputSchema},
  prompt: `You are an expert educator. Please read this syllabus and identify the different paper types (e.g., "Paper 1", "Written Exam", "Practical Assessment"). For each paper type, extract the list of topics or main sections covered under it.

Syllabus: {{media url=syllabusDataUri}}

Structure your output clearly, with each paper type as an object containing its name and a list of its topics.`,
});

const decomposeSyllabusFlow = ai.defineFlow(
  {
    name: 'decomposeSyllabusFlow',
    inputSchema: DecomposeSyllabusInputSchema,
    outputSchema: DecomposeSyllabusOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    
    // Ensure that the output always has a paperTypes array.
    const paperTypes = output?.paperTypes ?? [];
    return { paperTypes };
  }
);
