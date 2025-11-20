'use server';

/**
 * @fileOverview Generates a similar question variant based on an existing exam question.
 *
 * - generateSimilarQuestion - A function that creates a new question similar in structure and content.
 * - GenerateSimilarQuestionInput - The input type for the generateSimilarQuestion function.
 * - GenerateSimilarQuestionOutput - The return type for the generateSimilarQuestion function.
 */

import {z} from 'genkit';
import {executeWithManagedKey} from '@/ai/genkit';
import {requireAuth} from '@/lib/auth-helpers';

const GenerateSimilarQuestionInputSchema = z.object({
  originalQuestionText: z.string().describe('The original exam question to base the variant on.'),
  topicName: z.string().describe('The name of the topic this question covers.'),
  topicDescription: z.string().describe('The description of what this topic covers.'),
  originalObjectives: z.array(z.string()).optional().describe('The marking objectives from the original question markscheme. If not provided, objectives will be manufactured from the question text.'),
  originalDiagramMermaid: z.string().optional().describe('If the original question had a diagram, this contains the mermaid syntax. Should be adapted for the variant question.'),
});
export type GenerateSimilarQuestionInput = z.infer<typeof GenerateSimilarQuestionInputSchema>;

const GenerateSimilarQuestionOutputSchema = z.object({
  questionText: z.string().describe('The generated question variant that is similar but not identical to the original.'),
  summary: z.string().describe('A brief one-sentence summary of what this question variant is about.'),
  solutionObjectives: z.array(z.string()).describe('The marking objectives for this specific variant question, adapted from the original objectives to match the new question details.'),
  diagramMermaid: z.string().optional().describe('If the original question had a diagram, provide an adapted mermaid diagram syntax that matches the variant question changes. Must be consistent with variant values.'),
  validationError: z.string().optional().describe('If the generated solution objectives do not logically correspond to the variant question, describe the mismatch here. Otherwise, omit this field.'),
});
export type GenerateSimilarQuestionOutput = z.infer<typeof GenerateSimilarQuestionOutputSchema>;

const ValidateLatexFormattingInputSchema = z.object({
  questionText: z.string().describe('The question text to validate for LaTeX formatting errors.'),
});

const ValidateLatexFormattingOutputSchema = z.object({
  needsCorrection: z.boolean().describe('True if LaTeX formatting errors were found and corrected, false if the text was already correct.'),
  correctedText: z.string().describe('The corrected question text with proper LaTeX formatting. If needsCorrection is false, this should be identical to the input.'),
  errorsFound: z.array(z.string()).optional().describe('List of errors that were found and corrected (empty if needsCorrection is false).'),
});

/**
 * Validates and corrects LaTeX formatting in generated question text.
 * This acts as a self-correction mechanism to catch common LaTeX errors.
 */
async function validateAndCorrectLatex(
  ai: any,
  questionText: string
): Promise<{ correctedText: string; hadErrors: boolean }> {
  const validationPrompt = ai.definePrompt({
    name: 'validateLatexFormatting',
    input: { schema: ValidateLatexFormattingInputSchema },
    output: { schema: ValidateLatexFormattingOutputSchema },
    prompt: `You are a LaTeX formatting validator. Check if the question text has correct LaTeX formatting.

Question Text:
{{questionText}}

CRITICAL LATEX RULES TO CHECK:
1. Each $...$ must contain ONLY mathematical expressions, NO English words
2. Each $$...$$ must contain ONLY equations, NO English words
3. All mathematical notation MUST be inside $ or $$ delimiters
4. No text should be mixed with math inside delimiters
5. Tables must be in LaTeX array format, NOT pipe-separated plain text

COMMON ERRORS TO FIX:

Math formatting:
❌ "$y = y_0 + \\epsilon y_1 to determine the solution$"
   → Fix: "The equation $y = y_0 + \\epsilon y_1$ is used to determine the solution"

❌ "$$Calculate the force F = ma$$"
   → Fix: "Calculate the force:\\n$$F = ma$$"

❌ "velocity = 10 m/s"
   → Fix: "velocity = $10$ m/s" or "velocity $= 10$ m/s"

❌ "$x = 5 where x is the value$"
   → Fix: "where $x = 5$ is the value" or "$x = 5$, where $x$ is the value"

Table formatting:
❌ Plain text tables with pipes:
   "| x | y |
    | 1 | 2 |
    | 3 | 4 |"
   → Fix: Convert to LaTeX array format:
   "$$\\begin{array}{|c|c|}
    \\hline
    x & y \\\\
    \\hline
    1 & 2 \\\\
    3 & 4 \\\\
    \\hline
    \\end{array}$$"

❌ Tables without proper formatting:
   "x  y
    1  2
    3  4"
   → Fix: Convert to LaTeX array with proper alignment and separators

If you find ANY errors:
- Set needsCorrection = true
- Provide the corrected text in correctedText
- List what errors you found in errorsFound

If the text is ALREADY correctly formatted:
- Set needsCorrection = false
- Return the original text unchanged in correctedText
- Leave errorsFound empty

Validate and correct the text now.`,
  });

  const response = await validationPrompt({ questionText }, {
    model: 'googleai/gemini-2.5-flash-lite',
  });

  const output = response.output;
  if (!output) {
    // If validation fails, return original text
    return { correctedText: questionText, hadErrors: false };
  }

  if (output.needsCorrection && output.errorsFound && output.errorsFound.length > 0) {
    console.log('[LaTeX Validation] Errors found and corrected:');
    output.errorsFound.forEach((error: string, idx: number) => {
      console.log(`  ${idx + 1}. ${error}`);
    });
  }

  return {
    correctedText: output.correctedText,
    hadErrors: output.needsCorrection,
  };
}

export async function generateSimilarQuestion(
  input: GenerateSimilarQuestionInput
): Promise<GenerateSimilarQuestionOutput> {
  // Require authentication for rate limiting
  const user = await requireAuth();

  const startTime = Date.now();
  const hasObjectives = input.originalObjectives && input.originalObjectives.length > 0;
  console.log('[Process C] Starting similar question generation...');
  console.log(`[Process C] Mode: ${hasObjectives ? 'WITH solution objectives' : 'WITHOUT solution objectives (will manufacture)'}`);
  console.log('[Process C] ========== DEBUG: ORIGINAL QUESTION ==========');
  console.log(input.originalQuestionText);
  if (hasObjectives) {
    console.log('[Process C] ========== DEBUG: ORIGINAL SOLUTION ==========');
    input.originalObjectives!.forEach((obj, idx) => {
      console.log(`  ${idx + 1}. ${obj}`);
    });
  } else {
    console.log('[Process C] ========== DEBUG: NO MARKSCHEME AVAILABLE ==========');
    console.log('[Process C] Will manufacture solution objectives from question');
  }
  console.log('[Process C] ================================================');

  // Use the global API key manager to execute this flow with token-based rate limiting

  const result = await executeWithManagedKey(async (ai, flowInput) => {
    const prompt = ai.definePrompt({
      name: 'generateSimilarQuestionPrompt',
      input: {schema: GenerateSimilarQuestionInputSchema},
      output: {schema: GenerateSimilarQuestionOutputSchema},
      prompt: `You are an expert educator creating practice exam questions for students.

Your task is to generate a NEW question that is SIMILAR to the original question provided, but NOT IDENTICAL. You must also create marking objectives for your new variant.

Topic: {{topicName}}
Topic Description: {{topicDescription}}

Original Question:
{{originalQuestionText}}

{{#if originalDiagramMermaid}}
Original Diagram (Mermaid Syntax):
{{originalDiagramMermaid}}
{{/if}}

{{#if originalObjectives}}
Original Marking Objectives (from markscheme):
{{#each originalObjectives}}
  {{@index}}. {{this}}
{{/each}}

MODE: With Markscheme - Adapt the provided objectives to match your variant.
{{else}}
MODE: No Markscheme - You must manufacture appropriate marking objectives from scratch based on the question content.
{{/if}}

CRITICAL REQUIREMENT: The variant question MUST be similar but NOT the same as the original. You MUST change specific details, numbers, scenarios, or contexts.

Guidelines for generating the similar question:
1. MAINTAIN the same structure and format as the original (e.g., if it has parts a, b, c, keep that structure)
2. MAINTAIN the same difficulty level and assessment objectives
3. TEST the same concepts and skills from the topic
4. CHANGE the specific details, numbers, scenarios, or context to make it a unique variant
   - This is MANDATORY - do not create an identical copy
   - If the original has numbers, use DIFFERENT numbers
   - If the original has a specific scenario/context, use a DIFFERENT scenario/context
   - If the original has specific examples, use DIFFERENT examples
5. Ensure the question is realistic and could plausibly appear on an actual exam
6. Keep the same approximate length and complexity
7. The question should feel like it's from the same exam paper but testing the same knowledge in a slightly different way
8. FORMAT mathematical expressions using LaTeX - CRITICAL RULES:
   Each $...$ must contain ONLY a mathematical expression, NO English words.

   ✅ CORRECT examples:
   - "The equation $y = y_0 + \epsilon y_1$ represents the solution."
   - "Calculate:\n$$F = ma$$\nwhere $F$ is force."
   - "We use $x = 5$ to determine the result."

   ❌ WRONG - DO NOT do this (will produce garbage rendering):
   - "$y = y_0 + \epsilon y_1 to determine the solution$" (English inside $)
   - "$$Calculate F = ma where F is force$$" (English inside $$)
   - "velocity = 10 m/s" (missing $ around numbers)

   Close each $ immediately after the math expression, then continue with regular text.
   Use only standard LaTeX: ^{} _{} \frac{}{} \sqrt{} \times \div \alpha \beta \pi

9. FORMAT tables using LaTeX array syntax - CRITICAL:
   DO NOT use pipe-separated plain text tables. Use LaTeX array format instead.

   ✅ CORRECT table format:
   "$$\\begin{array}{|c|c|c|}
   \\hline
   x & y & z \\\\
   \\hline
   1 & 2 & 3 \\\\
   4 & 5 & 6 \\\\
   \\hline
   \\end{array}$$"

   ❌ WRONG - DO NOT use pipe-separated text:
   "| x | y | z |
    | 1 | 2 | 3 |
    | 4 | 5 | 6 |"

   Array syntax: {|c|c|c|} means 3 centered columns with vertical lines
   Use \\hline for horizontal lines, & to separate columns, \\\\ for new rows

Examples of proper variations:
- If the original asks about photosynthesis in plants → variant asks about photosynthesis in algae
- If the original uses 50 cm → variant uses 75 cm or 120 cm (different number)
- If the original describes a pendulum experiment → variant describes a similar but different pendulum setup
- If the original asks to "calculate velocity at 5 seconds" → variant asks to "calculate velocity at 8 seconds"

{{#if originalDiagramMermaid}}
After generating the question, ADAPT the mermaid diagram syntax:
- Update ALL measurements, values, and labels in the mermaid code to match your variant question
- Keep the same diagram type and structure (e.g., if it's a flowchart, keep it as a flowchart)
- Maintain the same level of detail and clarity
- If you changed numbers in the question (e.g., 3 cm → 6 cm), update them in the mermaid syntax
- If you changed the scenario/context, adapt the mermaid diagram accordingly
- The diagram must represent YOUR variant question, not the original
- Use proper mermaid syntax (graph, flowchart, sequenceDiagram, classDiagram, etc.)

Examples of proper mermaid diagram adaptation:
- Original: graph LR; A[3 cm] --> B → Variant: graph LR; A[6 cm] --> B
- Original: graph TD; Force["Force = 10 N"] → Variant: graph TD; Force["Force = 15 N"]
- For geometric diagrams, consider using flowchart with styled nodes
- For process flows, use flowchart or sequenceDiagram
- For relationships, use graph or classDiagram
{{/if}}

{{#if originalObjectives}}
After generating the question, ADAPT the marking objectives:
- Keep the SAME NUMBER of objectives as the original
- Maintain the SAME LEVEL of specificity and difficulty
- For ANY changes you made to the question, make corresponding changes to the objectives
- Update all numbers, formulas, and specific answers to match your variant question
- If the original objective mentions specific values/formulas, your objectives MUST reflect the new values/formulas from your variant
- The objectives should describe how to solve YOUR variant question, not the original

Examples of proper objective adaptation:
- Original: "Calculate wavelength using λ = 50 cm" → Variant: "Calculate wavelength using λ = 75 cm"
- Original: "Substitute velocity v = 10 m/s into equation" → Variant: "Substitute velocity v = 15 m/s into equation"
- Original: "Final answer: 25 Joules" → Variant: "Final answer: 40 Joules" (recalculated for new values)
- Original: "Explain photosynthesis in leaf cells" → Variant: "Explain photosynthesis in algae cells"
{{else}}
After generating the question, MANUFACTURE marking objectives from scratch:
- Analyze the question structure and identify all parts that need to be answered
- Create 3-6 specific marking objectives that cover all aspects of the answer
- Each objective should describe a specific step, concept, or piece of knowledge required
- Include expected calculations, formulas, or specific answers where applicable
- Make objectives specific enough that they could guide a marker to assess the answer
- Follow standard markscheme format (e.g., "State that...", "Calculate using...", "Explain the relationship between...")

Examples of manufactured objectives for different question types:
- Calculation question: ["Identify the correct formula F = ma", "Substitute values: m = 5 kg, a = 10 m/s²", "Calculate final answer: F = 50 N"]
- Explanation question: ["Define the term 'photosynthesis'", "Describe the role of chlorophyll", "Explain how light energy is converted to chemical energy"]
- Multi-part question: ["Part (a): State the definition of velocity", "Part (b): Calculate velocity using v = d/t with d = 100m, t = 10s", "Part (c): Explain why velocity is a vector quantity"]
{{/if}}

VALIDATION STEP (MANDATORY):
After generating the question, objectives{{#if originalDiagramMermaid}}, and mermaid diagram{{/if}}:
1. Check if your solution objectives logically correspond to your variant question
2. Verify that any numeric answers in objectives match the numbers/context in your question
3. Verify that any formulas or calculations in objectives use the correct values from your question
{{#if originalDiagramMermaid}}
4. Verify that your mermaid diagram syntax is valid and matches the values in your variant question (not the original)
5. Ensure all measurements, labels, and values in the mermaid diagram are consistent with your variant
{{/if}}
6. If you detect ANY mismatch or inconsistency, populate the validationError field with a description
7. If everything perfectly corresponds, leave validationError empty/omitted

Generate the similar question, adapted marking objectives{{#if originalDiagramMermaid}}, adapted mermaid diagram{{/if}}, and perform validation.`,
    });

    const response = await prompt(flowInput, {
      model: 'googleai/gemini-2.5-flash-lite',
    });
    const output = response.output;

    if (!output) {
      throw new Error('Failed to generate similar question - no output received');
    }

    // Check for validation errors
    if (output.validationError) {
      throw new Error(
        `Generated question validation failed: ${output.validationError}\n\n` +
        `This means the solution objectives do not match the generated question variant. ` +
        `Please try generating the question again or check the original question data.`
      );
    }

    // Validate and correct LaTeX formatting
    console.log('[Process C] Validating LaTeX formatting...');
    const latexValidation = await validateAndCorrectLatex(ai, output.questionText);

    if (latexValidation.hadErrors) {
      console.log('[Process C] LaTeX formatting was corrected automatically');
    } else {
      console.log('[Process C] LaTeX formatting is correct');
    }

    return {
      questionText: latexValidation.correctedText,
      summary: output.summary,
      solutionObjectives: output.solutionObjectives,
      diagramMermaid: output.diagramMermaid,
    };
  }, input, user.id);

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  console.log(`[Process C] Similar question generated in ${duration}s`);

  return result;
}
