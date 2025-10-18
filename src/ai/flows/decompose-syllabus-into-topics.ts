
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
  return decomposeSyllabusFlow(input);
}

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

const decomposeSyllabusFlow = ai.defineFlow(
  {
    name: 'decomposeSyllabusFlow',
    inputSchema: DecomposeSyllabusInputSchema,
    outputSchema: DecomposeSyllabusOutputSchema,
  },
  async input => {
    const startTime = Date.now();
    console.log('[Syllabus Processing] Started decomposing syllabus...');

    const response = await prompt(input, {
      model: 'googleai/gemini-2.5-flash',
    });
    const output = response.output;

    // Ensure that the output always has required fields.
    const subjectName = output?.subjectName ?? 'Untitled Subject';
    const paperTypes = output?.paperTypes ?? [];

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`[Syllabus Processing] Completed in ${duration}s`);
    console.log(`[Syllabus Processing] Found ${paperTypes.length} paper type(s) with ${paperTypes.reduce((acc, pt) => acc + pt.topics.length, 0)} total topics`);

    return { subjectName, paperTypes };
  }
);
