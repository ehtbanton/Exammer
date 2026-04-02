'use server';

/**
 * @fileOverview Matches all exam papers to their corresponding markschemes in a single prompt.
 *
 * - matchPapersToMarkschemes - A function that creates a mapping between papers and markschemes.
 * - MatchPapersToMarkschemesInput - The input type for the function.
 * - MatchPapersToMarkschemesOutput - The return type for the function.
 */

import {z} from 'genkit';
import {executeWithManagedKey} from '@/ai/genkit';

const PaperInfoSchema = z.object({
  name: z.string().describe('The filename of the paper.'),
  dataUri: z.string().describe('The paper file as a data URI.'),
});

const MarkschemeInfoSchema = z.object({
  name: z.string().describe('The filename of the markscheme.'),
  dataUri: z.string().describe('The markscheme file as a data URI.'),
});

const MatchPapersToMarkschemesInputSchema = z.object({
  papers: z.array(PaperInfoSchema).describe('All exam papers to be matched.'),
  markschemes: z.array(MarkschemeInfoSchema).describe('All available markschemes.'),
});
export type MatchPapersToMarkschemesInput = z.infer<typeof MatchPapersToMarkschemesInputSchema>;

const PaperMarkschemeMatchSchema = z.object({
  paperName: z.string().describe('The name of the paper.'),
  markschemeName: z.string().nullable().describe('The name of the matched markscheme, or null if no match found.'),
});

const MatchPapersToMarkschemesOutputSchema = z.object({
  matches: z.array(PaperMarkschemeMatchSchema).describe('Array of paper-to-markscheme matches.'),
});
export type MatchPapersToMarkschemesOutput = z.infer<typeof MatchPapersToMarkschemesOutputSchema>;

export async function matchPapersToMarkschemes(
  input: MatchPapersToMarkschemesInput
): Promise<MatchPapersToMarkschemesOutput> {
  const { papers, markschemes } = input;

  console.log(`[Paper-Markscheme Matching] Matching ${papers.length} papers to ${markschemes.length} markschemes in single prompt...`);

  const startTime = Date.now();

  try {
    const result = await executeWithManagedKey(async (ai, flowInput) => {
      const prompt = ai.definePrompt({
        name: 'matchPapersToMarkschemesPrompt',
        input: {schema: MatchPapersToMarkschemesInputSchema},
        output: {schema: MatchPapersToMarkschemesOutputSchema},
        prompt: `You are an expert at analyzing exam papers and their corresponding markschemes.

Your task is to match each exam paper to its corresponding markscheme by analyzing filenames, dates, paper identifiers, and content.

Exam Papers:
{{#each papers}}
- Name: {{name}}
  Content: {{media url=dataUri}}
{{/each}}

Available Markschemes:
{{#each markschemes}}
- Name: {{name}}
  Content: {{media url=dataUri}}
{{/each}}

For each paper, determine which markscheme (if any) corresponds to it. Match based on:
- Filename similarity (e.g., "paper1_2023.pdf" matches "paper1_2023_ms.pdf")
- Paper identifiers in the content (e.g., "Paper 1", "May 2023")
- Dates and session information
- Content structure and question references

Output the matches array with one entry per paper. If no markscheme matches a paper, set markschemeName to null.

IMPORTANT: Output exactly one match entry for each paper, in the same order as the input papers.`,
      });

      const response = await prompt(flowInput, {
        model: 'googleai/gemini-2.5-flash-lite',
      });
      const output = response.output;

      if (!output) {
        throw new Error('Failed to match papers to markschemes - no output received');
      }

      // Validate that we got exactly one match per paper
      if (output.matches.length !== flowInput.papers.length) {
        console.error(`[Paper-Markscheme Matching] ERROR: AI returned ${output.matches.length} matches for ${flowInput.papers.length} papers`);
        console.error(`[Paper-Markscheme Matching] Expected exactly one match per paper. Truncating/padding to match.`);

        // Truncate or pad to match paper count
        const validatedMatches = [];
        for (let i = 0; i < flowInput.papers.length; i++) {
          if (i < output.matches.length) {
            validatedMatches.push(output.matches[i]);
          } else {
            // Pad with null matches if AI returned too few
            validatedMatches.push({
              paperName: flowInput.papers[i].name,
              markschemeName: null,
            });
          }
        }

        return {
          matches: validatedMatches,
        };
      }

      return {
        matches: output.matches,
      };
    }, input);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    const matchedCount = result.matches.filter(m => m.markschemeName !== null).length;
    console.log(`[Paper-Markscheme Matching] Completed in ${duration}s - Matched ${matchedCount}/${papers.length} papers`);

    return result;
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.error(`[Paper-Markscheme Matching] Error after ${duration}s:`, error);
    throw error;
  }
}
