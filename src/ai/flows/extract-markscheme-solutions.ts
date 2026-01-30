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
import {
  isValidPaperIdentifier,
  getPaperIdentifierErrorMessage,
  getPaperIdentifierPromptRules,
  getSolutionIdPromptRules
} from './paper-identifier-validation';

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
  questionNumber: z.number().describe('The question number from the markscheme (e.g., 1, 2, 3). For multi-part solutions, use only the main number.'),
  solutionObjectives: z.array(z.string()).describe('List of specific marking objectives/criteria that students must achieve to gain full marks. Each objective should be a clear, measurable step including numeric/formulaic answers where applicable.'),
});

const ExtractMarkschemesSolutionsOutputSchema = z.object({
  paperTypeName: z.string().describe('The name of the paper type identified from the markscheme header/title (e.g., "Paper 1", "Paper 2"). Must match one from the provided paperTypes list.'),
  year: z.number().describe('The year from the markscheme (4 digits, e.g., 2022).'),
  month: z.number().describe('The month from the markscheme (1-12, e.g., 6 for June).'),
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
        model: 'googleai/gemini-3-flash-preview',
      });

      const prompt = aiInstance.definePrompt({
        name: 'extractMarkschemesSolutionsPrompt',
        input: {schema: ExtractMarkschemesSolutionsInputSchema},
        output: {schema: ExtractMarkschemesSolutionsOutputSchema},
        prompt: `TASK: Extract solutions from dated markscheme.

PAPER TYPES:
{{#each paperTypes}}
- {{name}}
{{/each}}

DOCUMENT:
{{media url=markschemeDataUri}}

EXTRACTION REQUIREMENTS:

1. PAPER IDENTIFICATION
   Steps:
   - Locate year in document (4 digits, e.g., 2022)
   - Locate month in document (as number 1-12, e.g., 6 for June)
   - Identify paper type name from header (must match one from PAPER TYPES list above)

   Example: Document shows "June 2022" and "Paper 2" → year: 2022, month: 6, paperTypeName: "Paper 2"

   CRITICAL: paperTypeName must match one from the PAPER TYPES list exactly.

2. SOLUTION IDENTIFICATION

   For each solution in the markscheme, identify the question number.
   Question numbers will be matched to exam paper questions later.

   For multi-part solutions (1a, 1b), use the main number only.

   Example: Solution for Question 3 with parts a, b, c → Question number: 3

   QUESTION NUMBER IDENTIFICATION PROCEDURE (MARKSCHEME-SPECIFIC):

   Markschemes mirror the structure of exam papers. To correctly identify solution numbers:

   a) Locate solution markers in the document:
      - Standard formats: "Question 1", "Question 2", "Q1", "Q2", "Answer 1", "Solution 1"
      - Numeric formats: "1.", "2)", "3." at the start of solution blocks
      - Visual emphasis: Numbers in bold or larger font preceding solution content

   b) Distinguish solution numbers from marking notation:
      - Marking codes (M1, A1, B1, E1, etc.) are NOT question numbers - these are marking points
      - Mark allocations ("[3]", "(5 marks)") are NOT question numbers
      - Page numbers in headers/footers are NOT question numbers
      - Sub-part labels standalone are NOT question numbers

   c) Handle multi-part solutions:
      - Solutions for "1a", "1(a)", "1 (a)", "1(i)", "1 i" all belong to Question 1
      - Combine all marking objectives from all sub-parts into a single solution array
      - Use the main question number only in the solution ID

   d) Validate against exam paper structure:
      - Markschemes have the same number of questions as the corresponding exam paper
      - Solutions should be numbered consecutively: 1, 2, 3, 4, 5, etc.
      - Typical markschemes contain 5-15 solutions
      - If numbering contains gaps, re-examine the document

   e) Extract comprehensive solution objectives:
      - Include all marking criteria for each question
      - Combine objectives from all sub-parts under the main question number
      - Ensure objectives are specific and verifiable

3. FOR EACH SOLUTION OUTPUT:
   - questionNumber: Just the number (e.g., 1, 2, 3)
   - solutionObjectives: Array of marking criteria

   Objective requirements:
   - Include numeric values, formulas, answers where present
   - Break multi-step calculations into separate objectives
   - Make each objective verifiable
   - Extract all marking points

   Valid examples:
   - "Identify wavelength λ = 500 nm from diagram"
   - "Calculate frequency using f = c/λ where c = 3×10⁸ m/s"
   - "Substitute: f = (3×10⁸)/(500×10⁻⁹)"
   - "Final answer: f = 6×10¹⁴ Hz"
   - "Explain: increasing temperature increases kinetic energy"
   - "State: increased collision frequency AND increased energy per collision"

VALIDATION REQUIREMENTS:

Before generating output, verify the following:
- Solution numbers are sequential without gaps (1, 2, 3, 4...)
- Total solution count matches expected question count (typically 5-15 solutions)
- Each solution has marking objectives (not empty)
- Multi-part solutions (1a, 1b, 1c) are combined under a single main number
- No marking codes (M1, A1, B1), page numbers, or mark allocations were misidentified as question numbers

OUTPUT STRUCTURE:
{
  "paperTypeName": "<name from PAPER TYPES list>",
  "year": <4-digit year>,
  "month": <1-12>,
  "solutions": [
    {
      "questionNumber": <integer>,
      "solutionObjectives": ["<objective 1>", "<objective 2>", ...]
    }
  ]
}

CRITICAL: paperTypeName must match one from the PAPER TYPES list provided above.`,
      });

      const flow = aiInstance.defineFlow(
        {
          name: 'extractMarkschemesSolutionsFlow',
          inputSchema: ExtractMarkschemesSolutionsInputSchema,
          outputSchema: ExtractMarkschemesSolutionsOutputSchema,
        },
        async input => {
          const MAX_RETRIES = 3;
          let lastError: string = '';

          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
              const response = await prompt(input);
              const output = response.output;

              if (!output) {
                throw new Error('No output received from AI model');
              }

              // Validate paper type name
              const paperTypeName = output.paperTypeName || '';
              if (!paperTypeName.trim()) {
                lastError = 'Missing paper type name.';
                console.warn(`[Markscheme Extraction] Attempt ${attempt}/${MAX_RETRIES} - ${lastError}`);

                if (attempt < MAX_RETRIES) {
                  console.log(`[Markscheme Extraction] Retrying with paper type identification...`);
                  continue;
                }

                throw new Error(`Paper type identification failed after ${MAX_RETRIES} attempts. ${lastError}`);
              }

              // Validate year
              const year = output.year ?? 0;
              if (year < 1900 || year > 2100) {
                lastError = `Invalid year: ${year}. Must be between 1900 and 2100.`;
                console.warn(`[Markscheme Extraction] Attempt ${attempt}/${MAX_RETRIES} - ${lastError}`);

                if (attempt < MAX_RETRIES) {
                  console.log(`[Markscheme Extraction] Retrying with year correction...`);
                  continue;
                }

                throw new Error(`Year validation failed after ${MAX_RETRIES} attempts. ${lastError}`);
              }

              // Validate month
              const month = output.month ?? 0;
              if (month < 1 || month > 12) {
                lastError = `Invalid month: ${month}. Must be between 1 and 12.`;
                console.warn(`[Markscheme Extraction] Attempt ${attempt}/${MAX_RETRIES} - ${lastError}`);

                if (attempt < MAX_RETRIES) {
                  console.log(`[Markscheme Extraction] Retrying with month correction...`);
                  continue;
                }

                throw new Error(`Month validation failed after ${MAX_RETRIES} attempts. ${lastError}`);
              }

              // Validate solutions array
              const solutions = output.solutions || [];
              if (solutions.length === 0) {
                lastError = 'No solutions extracted from markscheme.';
                console.warn(`[Markscheme Extraction] Attempt ${attempt}/${MAX_RETRIES} - ${lastError}`);

                if (attempt < MAX_RETRIES) {
                  console.log(`[Markscheme Extraction] Retrying solution extraction...`);
                  continue;
                }

                throw new Error(`Solution extraction failed after ${MAX_RETRIES} attempts. ${lastError}`);
              }

              // Validate each solution structure
              const validatedSolutions = solutions.map((s, index) => {
                // Validate question number
                if (typeof s.questionNumber !== 'number' || s.questionNumber < 1) {
                  console.warn(`[Markscheme Extraction] Solution at index ${index} has invalid questionNumber, using fallback`);
                  return {
                    ...s,
                    questionNumber: index + 1
                  };
                }

                // Validate solution objectives
                if (!Array.isArray(s.solutionObjectives) || s.solutionObjectives.length === 0) {
                  console.warn(`[Markscheme Extraction] Solution Q${s.questionNumber} has no objectives, adding placeholder`);
                  return {
                    ...s,
                    solutionObjectives: ['Complete the question as per the markscheme']
                  };
                }

                return s;
              });

              console.log(`[Markscheme Extraction] ✓ Validation passed on attempt ${attempt}`);

              return {
                paperTypeName,
                year,
                month,
                solutions: validatedSolutions
              };

            } catch (error: any) {
              if (attempt === MAX_RETRIES) {
                throw error;
              }
              console.warn(`[Markscheme Extraction] Attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`);
            }
          }

          throw new Error(`Extraction failed after ${MAX_RETRIES} attempts. Last error: ${lastError}`);
        }
      );

      return await flow({
        markschemeDataUri,
        paperTypes,
      });
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    const monthPadded = result.month.toString().padStart(2, '0');
    console.log(`[Markscheme Extraction] Completed in ${duration}s - Paper: ${result.year}-${monthPadded} "${result.paperTypeName}", Solutions: ${result.solutions.length}`);

    return result;
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.error(`[Markscheme Extraction] Error after ${duration}s:`, error);
    throw error;
  }
}
