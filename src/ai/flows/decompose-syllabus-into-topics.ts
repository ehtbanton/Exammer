
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
  subsections: z.array(z.string()).describe('A granular list of subsections for this topic.'),
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
  prompt: `You are an expert educator helping students to learn effectively for their exams.

Please read this syllabus and extract the following information:

1. The subject name (e.g., "Biology", "Computer Science A-Level", "GCSE Mathematics")
2. The different paper types (e.g., "Paper 1", "Written Exam", "Practical Assessment")
3. For each paper type, extract the list of topics or main sections covered under it
4. For each topic, generate a granular list of subsections that comprehensively cover the topic

Syllabus: {{media url=syllabusDataUri}}

Structure your output clearly:
- Identify the subject name from the syllabus
- Each paper type should contain its name and a list of topics
- Each topic should contain its name and a list of subsections
- Subsections should be specific, granular areas of study within each topic to help students understand the scope of learning required`,
});

const decomposeSyllabusFlow = ai.defineFlow(
  {
    name: 'decomposeSyllabusFlow',
    inputSchema: DecomposeSyllabusInputSchema,
    outputSchema: DecomposeSyllabusOutputSchema,
  },
  async input => {
    const response = await prompt(input);
    const output = response.output;

    // Ensure that the output always has required fields.
    const subjectName = output?.subjectName ?? 'Untitled Subject';
    const paperTypes = output?.paperTypes ?? [];
    return { subjectName, paperTypes };
  }
);
