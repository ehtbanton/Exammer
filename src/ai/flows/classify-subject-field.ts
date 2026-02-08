'use server';

/**
 * @fileOverview Classifies a subject into its academic field, subfield, level, and keywords.
 * Used after syllabus decomposition to enable cross-curriculum comparison.
 *
 * - classifySubjectField - Classifies a subject's academic domain
 * - ClassifySubjectFieldInput - Input type
 * - ClassifySubjectFieldOutput - Output type
 */

import { z } from 'genkit';
import { executeWithManagedKey } from '@/ai/genkit';

const ClassifySubjectFieldInputSchema = z.object({
  subjectName: z.string().describe('The name of the subject/course'),
  topicNames: z.array(z.string()).describe('List of topic names from the syllabus'),
  syllabusExcerpt: z.string().optional().describe('First ~2000 characters of syllabus content'),
});
export type ClassifySubjectFieldInput = z.infer<typeof ClassifySubjectFieldInputSchema>;

const ClassifySubjectFieldOutputSchema = z.object({
  field: z.string().describe('Broad academic field, e.g., "Mathematics", "Computer Science", "Physics", "Biology"'),
  subfield: z.string().describe('More specific subfield, e.g., "Pure Mathematics", "Deep Learning", "Quantum Mechanics"'),
  level: z.string().describe('Academic level, e.g., "GCSE", "A-Level", "IB", "Undergraduate", "Postgraduate"'),
  keywords: z.array(z.string()).describe('5-10 semantic keywords for similarity matching with other subjects'),
});
export type ClassifySubjectFieldOutput = z.infer<typeof ClassifySubjectFieldOutputSchema>;

export async function classifySubjectField(
  input: ClassifySubjectFieldInput
): Promise<ClassifySubjectFieldOutput> {
  const startTime = Date.now();
  console.log(`[ClassifyField] Classifying subject: ${input.subjectName}`);

  const result = await executeWithManagedKey(async (ai, flowInput) => {
    const prompt = ai.definePrompt({
      name: 'classifySubjectField',
      input: { schema: ClassifySubjectFieldInputSchema },
      output: { schema: ClassifySubjectFieldOutputSchema },
      prompt: `You are an academic classification expert. Classify this subject into its academic field.

Subject Name: {{subjectName}}

Topics covered:
{{#each topicNames}}
- {{this}}
{{/each}}

{{#if syllabusExcerpt}}
Syllabus excerpt:
{{syllabusExcerpt}}
{{/if}}

Classify into:
1. **field**: The broad academic discipline (e.g., "Mathematics", "Computer Science", "Physics", "Economics", "English Literature")
2. **subfield**: A more specific area (e.g., "Pure Mathematics", "Machine Learning", "Organic Chemistry")
3. **level**: The academic level based on the content depth and subject name (e.g., "GCSE", "A-Level", "IB", "Undergraduate", "Postgraduate")
4. **keywords**: 5-10 semantic keywords that capture the core concepts. These will be used to find similar subjects, so include both broad and specific terms.

Be precise and consistent - two subjects in the same field should have the same "field" value (e.g., always "Mathematics", never "Maths" vs "Mathematics").`,
    });

    const response = await prompt(flowInput, {
      model: 'googleai/gemini-2.5-flash-lite',
    });

    const output = response.output;
    return {
      field: output?.field ?? 'Unknown',
      subfield: output?.subfield ?? 'General',
      level: output?.level ?? 'Unknown',
      keywords: output?.keywords ?? [],
    };
  }, input);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[ClassifyField] Classified as ${result.field} / ${result.subfield} (${result.level}) in ${duration}s`);

  return result;
}
