'use server';
/**
 * @fileOverview Generates a granular list of subsections for a given topic using AI.
 *
 * - generateGranularSubsections - A function that generates the subsections.
 * - GenerateGranularSubsectionsInput - The input type for the generateGranularSubsections function.
 * - GenerateGranularSubsectionsOutput - The return type for the generateGranularSubsections function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateGranularSubsectionsInputSchema = z.object({
  topic: z.string().describe('The main topic to generate subsections for.'),
  examSyllabus: z.string().describe('The exam syllabus content.'),
  pastPapers: z.array(z.string()).describe('Array of past exam papers as strings.'),
});

export type GenerateGranularSubsectionsInput = z.infer<
  typeof GenerateGranularSubsectionsInputSchema
>;

const GenerateGranularSubsectionsOutputSchema = z.object({
  subsections: z
    .array(z.string())
    .describe('A list of granular subsections for the given topic.'),
});

export type GenerateGranularSubsectionsOutput = z.infer<
  typeof GenerateGranularSubsectionsOutputSchema
>;

export async function generateGranularSubsections(
  input: GenerateGranularSubsectionsInput
): Promise<GenerateGranularSubsectionsOutput> {
  return generateGranularSubsectionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateGranularSubsectionsPrompt',
  input: {schema: GenerateGranularSubsectionsInputSchema},
  output: {schema: GenerateGranularSubsectionsOutputSchema},
  prompt: `You are an expert educator helping students to learn effectively for their exams.

You will receive a topic, the exam syllabus, and a collection of past exam papers.
Your task is to generate a granular list of subsections for the topic, to help the student understand the scope of the topic and focus their learning.

Topic: {{{topic}}}
Syllabus: {{{examSyllabus}}}
Past Papers: {{#each pastPapers}} - {{{this}}}{{/each}}

Please generate a list of subsections that comprehensively cover the topic, taking into account the syllabus and past papers. Make sure each subsection is relatively granular.

Desired subsections (delimited by newlines):`,
});

const generateGranularSubsectionsFlow = ai.defineFlow(
  {
    name: 'generateGranularSubsectionsFlow',
    inputSchema: GenerateGranularSubsectionsInputSchema,
    outputSchema: GenerateGranularSubsectionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    const subsections =
      output?.subsections ?? ([] as GenerateGranularSubsectionsOutput['subsections']);
    return {subsections};
  }
);
