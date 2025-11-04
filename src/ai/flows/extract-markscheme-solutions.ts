'use server';

/**
 * @fileOverview Extracts solution objectives from a single markscheme.
 *
 * This flow is part of the redesigned parallel extraction workflow where papers and
 * markschemes are processed separately and then matched mechanically.
 */

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {z} from 'genkit';
import {geminiApiKeyManager} from '@root/gemini-api-key-manager';

const PaperTypeInfoSchema = z.object({
  name: z.string().describe('The name of the paper type.'),
});

const ExtractMarkschemesSolutionsInputSchema = z.object({
  markschemeDataUri: z
    .string()
    .describe(
      "A single markscheme in PDF format, as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
  paperTypes: z
    .array(PaperTypeInfoSchema)
    .describe('The list of paper types from the syllabus (ordered array).'),
});
export type ExtractMarkschemesSolutionsInput = z.infer<typeof ExtractMarkschemesSolutionsInputSchema>;

const MarkschemesSolutionSchema = z.object({
  questionNumber: z.number().describe('The question number this solution corresponds to (e.g., 1, 2, 3, 4).'),
  solutionObjectives: z.array(z.string()).describe('List of specific marking objectives/criteria that students must achieve to gain full marks. Each objective should be a clear, measurable step including numeric/formulaic answers where applicable.'),
});

const ExtractMarkschemesSolutionsOutputSchema = z.object({
  paperTypeIndex: z.number().describe('The 0-based index of the paper type from the provided paperTypes array.'),
  paperIdentifier: z.string().describe('A unique identifier for the specific exam this markscheme belongs to, extracted from the markscheme content (e.g., "2022 June", "Specimen 2023").'),
  solutions: z.array(MarkschemesSolutionSchema).describe('All solutions with marking objectives extracted from this markscheme.'),
});
export type ExtractMarkschemesSolutionsOutput = z.infer<typeof ExtractMarkschemesSolutionsOutputSchema>;

export async function extractMarkschemesSolutions(
  input: ExtractMarkschemesSolutionsInput
): Promise<ExtractMarkschemesSolutionsOutput> {
  const { markschemeDataUri, paperTypes } = input;

  console.log(`[Markscheme Extraction] Processing markscheme...`);

  const startTime = Date.now();

  try {
    const result = await geminiApiKeyManager.withKey(async (apiKey) => {
      const aiInstance = genkit({
        plugins: [googleAI({ apiKey })],
        model: 'googleai/gemini-2.5-flash-lite',
      });

      const prompt = aiInstance.definePrompt({
        name: 'extractMarkschemesSolutionsPrompt',
        input: {schema: ExtractMarkschemesSolutionsInputSchema},
        output: {schema: ExtractMarkschemesSolutionsOutputSchema},
        prompt: `You are an expert educator analyzing a markscheme to extract marking criteria and solution objectives.

Your task is to:
1. Determine which paper type this markscheme belongs to by examining the title/header
2. Extract a unique identifier for this specific paper from the content (year, session, variant)
3. For each solution in the markscheme, identify the question number it corresponds to
4. Extract the marking objectives/criteria as a list of specific, measurable steps

Available paper types (0-indexed array):
{{#each paperTypes}}
{{@index}}. {{name}}
{{/each}}

Markscheme:
{{media url=markschemeDataUri}}

CRITICAL INSTRUCTIONS:

Paper Type Identification:
- Examine the markscheme title/header carefully
- Output the 0-based INDEX (number) of the matching paper type from the list above
- Example: If this is for "Paper 1", output paperTypeIndex: 0 (if "Paper 1" is at index 0)

Paper Identifier Extraction:
- Extract the specific identifier from the markscheme content (NOT the filename)
- Look for year, session/month, variant, specimen/sample designation
- Examples: "2022 June", "2023 November Variant 1", "Specimen 2024", "Sample Paper"
- This should uniquely identify which specific past paper this markscheme is for
- Be consistent in format (e.g., always "YYYY Month" or "Specimen YYYY")
- MUST match exactly with the format you would use for the corresponding exam paper

Solution Extraction:
- For each solution, identify its question number (integer only, e.g., 1, 2, 3, 4)
- Extract ALL marking objectives for that solution
- Even if solutions are not provided for every question, extract what is available
- Each solution MUST have: questionNumber (integer) and solutionObjectives (array of strings)

Solution Objectives Guidelines:
- Each objective should represent a marking criterion or step that awards marks
- Include specific numeric values, formulas, or answers where present
- Examples of good objectives:
  * "Identify the wavelength λ = 500 nm from the diagram"
  * "Calculate frequency using f = c/λ where c = 3×10⁸ m/s"
  * "Substitute values: f = (3×10⁸)/(500×10⁻⁹)"
  * "Final answer: f = 6×10¹⁴ Hz"
  * "Explain that increasing temperature increases kinetic energy"
  * "State two effects: increased collision frequency AND increased energy per collision"
- Each objective should be specific enough that a teacher could check it against student work
- Break down multi-step calculations into separate objectives
- Include method marks (e.g., "Use correct formula") and answer marks (e.g., "Obtain correct final answer")

Important Notes:
- Do NOT include topic categorization (this is done separately for questions)
- Focus ONLY on extracting marking criteria as they appear in the markscheme
- Be thorough - extract ALL marking points for each solution
- If a solution has multiple parts (a, b, c), include objectives for all parts under the same questionNumber`,
      });

      const flow = aiInstance.defineFlow(
        {
          name: 'extractMarkschemesSolutionsFlow',
          inputSchema: ExtractMarkschemesSolutionsInputSchema,
          outputSchema: ExtractMarkschemesSolutionsOutputSchema,
        },
        async input => {
          const response = await prompt(input);
          const output = response.output;

          if (!output) {
            throw new Error('No output received from AI model');
          }

          // Validate required fields
          const paperTypeIndex = output.paperTypeIndex ?? -1;
          const paperIdentifier = output.paperIdentifier || 'Unknown';
          const solutions = output.solutions || [];

          if (paperTypeIndex < 0 || paperTypeIndex >= paperTypes.length) {
            console.warn(`[Markscheme Extraction] Invalid paperTypeIndex: ${paperTypeIndex}, defaulting to 0`);
          }

          // Validate each solution
          const validatedSolutions = solutions.map((s, index) => {
            if (typeof s.questionNumber !== 'number') {
              console.warn(`[Markscheme Extraction] Solution at index ${index} has invalid questionNumber, using index`);
              return {
                ...s,
                questionNumber: index + 1
              };
            }
            if (!Array.isArray(s.solutionObjectives) || s.solutionObjectives.length === 0) {
              console.warn(`[Markscheme Extraction] Solution ${s.questionNumber} has no objectives, adding placeholder`);
              return {
                ...s,
                solutionObjectives: ['Complete the question as per the markscheme']
              };
            }
            return s;
          });

          return {
            paperTypeIndex: Math.max(0, Math.min(paperTypeIndex, paperTypes.length - 1)),
            paperIdentifier,
            solutions: validatedSolutions
          };
        }
      );

      return await flow({
        markschemeDataUri,
        paperTypes,
      });
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`[Markscheme Extraction] Completed in ${duration}s - Paper: ${result.paperIdentifier}, Type Index: ${result.paperTypeIndex}, Solutions: ${result.solutions.length}`);

    return result;
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.error(`[Markscheme Extraction] Error after ${duration}s:`, error);
    throw error;
  }
}
