'use server';

/**
 * @fileOverview Generates related academic and career terms for brainstorming.
 *
 * - expandBrainstormNode - Generates 5 related terms for a given academic interest
 * - ExpandBrainstormNodeInput - The input type for the expandBrainstormNode function
 * - ExpandBrainstormNodeOutput - The return type for the expandBrainstormNode function
 */

import { z } from 'genkit';
import { executeWithManagedKey } from '@/ai/genkit';

const ExpandBrainstormNodeInputSchema = z.object({
  nodeLabel: z.string().describe('The current academic interest or career term to expand'),
  parentPath: z.array(z.string()).optional().describe('The path of parent nodes from root to current'),
});
export type ExpandBrainstormNodeInput = z.infer<typeof ExpandBrainstormNodeInputSchema>;

const ExpandBrainstormNodeOutputSchema = z.object({
  suggestions: z.array(z.string()).describe('Exactly 5 related academic subjects, career paths, or specific areas of study'),
});
export type ExpandBrainstormNodeOutput = z.infer<typeof ExpandBrainstormNodeOutputSchema>;

/**
 * Generates 5 related terms for brainstorming career paths
 */
export async function expandBrainstormNode(
  input: ExpandBrainstormNodeInput
): Promise<ExpandBrainstormNodeOutput> {
  return await executeWithManagedKey(async (ai) => {
    const expandPrompt = ai.definePrompt({
      name: 'expandBrainstormNode',
      input: {
        schema: ExpandBrainstormNodeInputSchema,
      },
      output: {
        schema: ExpandBrainstormNodeOutputSchema,
      },
      prompt: `You are a career guidance expert helping a student explore academic interests and career paths.

Given a term or interest area, generate **exactly 5** related terms that help the student discover potential career paths and university subjects.

**Current term:** {{nodeLabel}}

{{#if parentPath}}
**Context (path from root):** {{#each parentPath}}{{this}} → {{/each}}{{nodeLabel}}
{{/if}}

**Guidelines:**
1. Generate exactly 5 related terms (no more, no less)
2. Each term should be 2-4 words maximum
3. Make terms progressively more specific and actionable
4. Include mix of:
   - Related academic subjects
   - Career paths or job roles
   - Specific areas of specialization
   - Skills or competencies
5. Terms should help student discover university courses they might want to study
6. Be relevant to UK/international university system (A-levels, undergraduate degrees)
7. Avoid repeating terms from the parent path
8. Make suggestions inspiring and diverse

**Examples:**

Input: "Mathematics"
Output: ["Data Science", "Financial Analysis", "Engineering", "Computer Science", "Economics"]

Input: "Writing Stories"
Output: ["Creative Writing", "Journalism", "English Literature", "Screenwriting", "Publishing"]

Input: "Helping People"
Output: ["Medicine", "Psychology", "Social Work", "Teaching", "Law"]

Generate 5 related terms that will help expand this brainstorming tree.`,
    }, { model: 'googleai/gemini-2.0-flash-exp' });

    const result = await expandPrompt(input);

    return result.output;
  });
}
