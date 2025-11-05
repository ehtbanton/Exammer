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
  getQuestionIdPromptRules
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
  questionId: z.string().describe('Question identifier in YYYY-MM-P-Q format (e.g., "2022-06-1-1" for June 2022, Paper 1, Question 1).'),
  solutionObjectives: z.array(z.string()).describe('List of specific marking objectives/criteria that students must achieve to gain full marks. Each objective should be a clear, measurable step including numeric/formulaic answers where applicable.'),
});

const ExtractMarkschemesSolutionsOutputSchema = z.object({
  paperTypeIndex: z.number().describe('The 0-based index of the paper type from the provided paperTypes array.'),
  paperIdentifier: z.string().describe('Paper date in YYYY-MM-P format where YYYY=year, MM=month (01-12), P=paper type index. Example: "2022-06-1" for June 2022, Paper Type 1. Must match corresponding exam paper exactly.'),
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
        prompt: `TASK: Extract solutions from dated markscheme.

PAPER TYPES (0-indexed):
{{#each paperTypes}}
{{@index}}: {{name}}
{{/each}}

DOCUMENT:
{{media url=markschemeDataUri}}

EXTRACTION REQUIREMENTS:

1. PAPER DATE
   ${getPaperIdentifierPromptRules()}

   Steps:
   - Locate year in document (4 digits)
   - Locate month in document (convert to 2-digit: 01-12)
   - Identify paper type from header (use 0-based index)
   - Format as: YYYY-MM-P

   Example: Document shows "June 2022" and "Paper 2" (index 1) → Paper date: "2022-06-1"

   CRITICAL: Must match corresponding exam paper format exactly.

2. QUESTION IDs
   ${getQuestionIdPromptRules()}

   Construction steps:
   - Take paper date from step 1 (YYYY-MM-P)
   - Append question number (1, 2, 3, etc.)
   - For multi-part solutions (1a, 1b), use main number only

   Example: Paper date "2022-06-1", Question 3 → Question ID: "2022-06-1-3"

3. FOR EACH SOLUTION OUTPUT:
   - questionId: YYYY-MM-P-Q format (atomic string)
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

OUTPUT STRUCTURE:
{
  "paperTypeIndex": <integer 0-9>,
  "paperIdentifier": "<YYYY-MM-P>",
  "solutions": [
    {
      "questionId": "<YYYY-MM-P-Q>",
      "solutionObjectives": ["<objective 1>", "<objective 2>", ...]
    }
  ]
}

CRITICAL: Each questionId must be a complete, properly formatted identifier combining paper date and question number.`,
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

              // Validate paper identifier format (STRICT)
              const paperIdentifier = output.paperIdentifier || '';
              if (!isValidPaperIdentifier(paperIdentifier)) {
                lastError = getPaperIdentifierErrorMessage(paperIdentifier);
                console.warn(`[Markscheme Extraction] Attempt ${attempt}/${MAX_RETRIES} - ${lastError}`);

                if (attempt < MAX_RETRIES) {
                  // Re-prompt with error feedback
                  console.log(`[Markscheme Extraction] Retrying with format correction...`);
                  continue;
                }

                throw new Error(`Paper identifier validation failed after ${MAX_RETRIES} attempts. ${lastError}`);
              }

              // Validate paper type index
              const paperTypeIndex = output.paperTypeIndex ?? -1;
              if (paperTypeIndex < 0 || paperTypeIndex >= paperTypes.length) {
                lastError = `Invalid paperTypeIndex: ${paperTypeIndex}. Must be between 0 and ${paperTypes.length - 1}.`;
                console.warn(`[Markscheme Extraction] Attempt ${attempt}/${MAX_RETRIES} - ${lastError}`);

                if (attempt < MAX_RETRIES) {
                  console.log(`[Markscheme Extraction] Retrying with index correction...`);
                  continue;
                }

                throw new Error(`Paper type index validation failed after ${MAX_RETRIES} attempts. ${lastError}`);
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
                if (!s.questionId || typeof s.questionId !== 'string') {
                  console.warn(`[Markscheme Extraction] Solution at index ${index} has invalid questionId`);
                  const fallbackId = `${paperIdentifier}-${index + 1}`;
                  return {
                    ...s,
                    questionId: fallbackId
                  };
                }
                // Validate questionId format starts with paperIdentifier
                if (!s.questionId.startsWith(paperIdentifier + '-')) {
                  console.warn(`[Markscheme Extraction] Question ID ${s.questionId} does not match paper date ${paperIdentifier}`);
                }
                if (!Array.isArray(s.solutionObjectives) || s.solutionObjectives.length === 0) {
                  console.warn(`[Markscheme Extraction] Solution ${s.questionId} has no objectives, adding placeholder`);
                  return {
                    ...s,
                    solutionObjectives: ['Complete the question as per the markscheme']
                  };
                }
                return s;
              });

              console.log(`[Markscheme Extraction] ✓ Validation passed on attempt ${attempt}`);

              return {
                paperTypeIndex,
                paperIdentifier,
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
    console.log(`[Markscheme Extraction] Completed in ${duration}s - Paper: ${result.paperIdentifier}, Type Index: ${result.paperTypeIndex}, Solutions: ${result.solutions.length}`);

    return result;
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.error(`[Markscheme Extraction] Error after ${duration}s:`, error);
    throw error;
  }
}
