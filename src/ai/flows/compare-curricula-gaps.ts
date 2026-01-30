'use server';

/**
 * @fileOverview Compares two subjects' topic lists to identify curriculum gaps.
 * Finds topics present in one subject but missing from another, using semantic
 * comparison (not just string matching).
 *
 * - compareCurriculaGaps - Compares two subjects and returns gaps in each direction
 * - CompareCurriculaGapsInput - Input type
 * - CompareCurriculaGapsOutput - Output type
 */

import { z } from 'genkit';
import { executeWithManagedKey } from '@/ai/genkit';

const SubjectTopicsSchema = z.object({
  name: z.string().describe('Subject name'),
  topics: z.array(z.object({
    name: z.string().describe('Topic name'),
    description: z.string().describe('Topic description'),
  })).describe('List of topics with descriptions'),
});

const GapSchema = z.object({
  topicName: z.string().describe('Name of the topic that is missing'),
  topicDescription: z.string().describe('Description of what this topic covers'),
  relevanceReason: z.string().describe('Why students of the other subject should know this topic'),
  confidenceScore: z.number().min(0).max(100).describe('How confident that this is a genuine gap (not just a naming difference)'),
});

const CompareCurriculaGapsInputSchema = z.object({
  subjectA: SubjectTopicsSchema.describe('First subject to compare'),
  subjectB: SubjectTopicsSchema.describe('Second subject to compare'),
});
export type CompareCurriculaGapsInput = z.infer<typeof CompareCurriculaGapsInputSchema>;

const CompareCurriculaGapsOutputSchema = z.object({
  gapsInB: z.array(GapSchema).describe('Topics present in subject A but missing from subject B'),
  gapsInA: z.array(GapSchema).describe('Topics present in subject B but missing from subject A'),
  overlapSummary: z.string().describe('Brief description of shared content between the two subjects'),
});
export type CompareCurriculaGapsOutput = z.infer<typeof CompareCurriculaGapsOutputSchema>;

export async function compareCurriculaGaps(
  input: CompareCurriculaGapsInput
): Promise<CompareCurriculaGapsOutput> {
  const startTime = Date.now();
  console.log(`[CurriculaGaps] Comparing "${input.subjectA.name}" vs "${input.subjectB.name}"`);

  const result = await executeWithManagedKey(async (ai, flowInput) => {
    const prompt = ai.definePrompt({
      name: 'compareCurriculaGaps',
      input: { schema: CompareCurriculaGapsInputSchema },
      output: { schema: CompareCurriculaGapsOutputSchema },
      prompt: `You are an expert curriculum analyst. Compare these two subjects and identify meaningful topic gaps between them.

**Subject A: {{subjectA.name}}**
Topics:
{{#each subjectA.topics}}
- {{name}}: {{description}}
{{/each}}

**Subject B: {{subjectB.name}}**
Topics:
{{#each subjectB.topics}}
- {{name}}: {{description}}
{{/each}}

**Your task:**

1. **Identify gaps in Subject B** - Topics covered in A but NOT in B. These are topics that students of B might benefit from learning.

2. **Identify gaps in Subject A** - Topics covered in B but NOT in A. These are topics that students of A might benefit from learning.

3. **Provide an overlap summary** - Brief description of what both subjects share.

**CRITICAL RULES:**
- Use SEMANTIC comparison, not just string matching. "Group Theory" and "Abstract Algebra" may substantially overlap. "Differentiation" and "Derivatives" are the same thing.
- Only report SUBSTANTIAL gaps - topics that represent genuinely different content areas, not minor naming variations.
- Each gap must have a relevance reason explaining WHY students of the other subject should care about this topic.
- Set confidence score HIGH (80-100) when the gap is clearly a different content area, MEDIUM (50-79) when there's partial overlap, LOW (below 50) when you're unsure if it's a real gap.
- If the two subjects are in different fields entirely, return empty gap arrays - cross-field comparison is not useful.
- Limit to the 5-8 most significant gaps per direction.`,
    });

    const response = await prompt(flowInput, {
      model: 'googleai/gemini-flash-latest',
    });

    const output = response.output;
    return {
      gapsInB: output?.gapsInB ?? [],
      gapsInA: output?.gapsInA ?? [],
      overlapSummary: output?.overlapSummary ?? 'Unable to determine overlap.',
    };
  }, input);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[CurriculaGaps] Found ${result.gapsInB.length} gaps in B, ${result.gapsInA.length} gaps in A (${duration}s)`);

  return result;
}
