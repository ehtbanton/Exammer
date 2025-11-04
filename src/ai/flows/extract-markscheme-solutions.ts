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
        prompt: `You are analyzing a markscheme to extract structured solution data. Please follow these instructions carefully to ensure consistency with the corresponding exam paper.

Task Overview:
1. Identify the paper type by examining the document header/title
2. Extract a standardized identifier for this specific exam
3. Extract all solutions with their question numbers
4. List the marking objectives for each solution

Available Paper Types (0-indexed):
{{#each paperTypes}}
Index {{@index}}: {{name}}
{{/each}}

Markscheme:
{{media url=markschemeDataUri}}

Instructions:

Step 1 - Paper Type Index:
Examine the markscheme's title or header to determine which paper type this is.
Output the 0-based index number from the paper types list above.
Example: If the markscheme says "Paper 2" and "Paper 2" appears at index 1 in the list, output paperTypeIndex: 1

Step 2 - Paper Identifier:
Extract a standardized identifier from the markscheme content itself (not the filename).
Use this exact format: "YYYY Month" for regular exams, or "Specimen YYYY" / "Sample YYYY" for specimen/sample papers.

Format examples:
- "2022 June" (for June 2022 exam)
- "2023 November" (for November 2023 exam)
- "Specimen 2024" (for 2024 specimen paper)
- "Sample 2023" (for 2023 sample paper)

Important: Always use the full 4-digit year. Use the month name, not numbers. This must match the format used in the paper extraction exactly.

Step 3 - Question Numbers:
For each solution in the markscheme, identify the main question number as an integer (1, 2, 3, 4, etc.).
If the solution covers multiple parts (e.g., 1a, 1b, 1c), use the main number only (1).
Include objectives for all parts under the same question number.

Step 4 - Solution Objectives:
For each solution, extract the marking criteria as a list of specific, measurable objectives.
Each objective should represent a step or criterion that earns marks.

Objective examples:
- "Identify the wavelength λ = 500 nm from the diagram"
- "Calculate frequency using f = c/λ where c = 3×10⁸ m/s"
- "Substitute values: f = (3×10⁸)/(500×10⁻⁹)"
- "Final answer: f = 6×10¹⁴ Hz"
- "Explain that increasing temperature increases kinetic energy"
- "State two effects: increased collision frequency AND increased energy per collision"

Guidelines for objectives:
- Include specific numeric values, formulas, or answers where present
- Break down multi-step calculations into separate objectives
- Each objective should be specific enough for a teacher to verify
- Include both method marks and answer marks
- Extract all marking points thoroughly

Extract all solutions available in the markscheme, even if some questions are missing solutions.

Output Requirements:
- paperTypeIndex: Must be a valid index from the paper types list (0, 1, 2, etc.)
- paperIdentifier: Must follow the format "YYYY Month" or "Specimen YYYY" (matching paper format)
- solutions: Array of all solutions with questionNumber (integer) and solutionObjectives (array of strings)`,
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
