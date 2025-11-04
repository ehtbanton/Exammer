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

const GenerateSimilarQuestionInputSchema = z.object({
  originalQuestionText: z.string().describe('The original exam question to base the variant on.'),
  topicName: z.string().describe('The name of the topic this question covers.'),
  topicDescription: z.string().describe('The description of what this topic covers.'),
  originalObjectives: z.array(z.string()).describe('The marking objectives from the original question markscheme.'),
});
export type GenerateSimilarQuestionInput = z.infer<typeof GenerateSimilarQuestionInputSchema>;

const GenerateSimilarQuestionOutputSchema = z.object({
  questionText: z.string().describe('The generated question variant that is similar but not identical to the original.'),
  summary: z.string().describe('A brief one-sentence summary of what this question variant is about.'),
  solutionObjectives: z.array(z.string()).describe('The marking objectives for this specific variant question, adapted from the original objectives to match the new question details.'),
  validationError: z.string().optional().describe('If the generated solution objectives do not logically correspond to the variant question, describe the mismatch here. Otherwise, omit this field.'),
});
export type GenerateSimilarQuestionOutput = z.infer<typeof GenerateSimilarQuestionOutputSchema>;

export async function generateSimilarQuestion(
  input: GenerateSimilarQuestionInput
): Promise<GenerateSimilarQuestionOutput> {
  const startTime = Date.now();
  console.log('[Process C] Starting similar question generation...');

  // Use the global API key manager to execute this flow

  const result = await executeWithManagedKey(async (ai, flowInput) => {
    const prompt = ai.definePrompt({
      name: 'generateSimilarQuestionPrompt',
      input: {schema: GenerateSimilarQuestionInputSchema},
      output: {schema: GenerateSimilarQuestionOutputSchema},
      prompt: `You are an expert educator creating practice exam questions for students.

Your task is to generate a NEW question that is SIMILAR to the original question provided, but NOT IDENTICAL. You must also adapt the marking objectives to match your new variant.

Topic: {{topicName}}
Topic Description: {{topicDescription}}

Original Question:
{{originalQuestionText}}

Original Marking Objectives (from markscheme):
{{#each originalObjectives}}
  {{@index}}. {{this}}
{{/each}}

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

Examples of proper variations:
- If the original asks about photosynthesis in plants → variant asks about photosynthesis in algae
- If the original uses 50 cm → variant uses 75 cm or 120 cm (different number)
- If the original describes a pendulum experiment → variant describes a similar but different pendulum setup
- If the original asks to "calculate velocity at 5 seconds" → variant asks to "calculate velocity at 8 seconds"

After generating the question, adapt the marking objectives:
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

VALIDATION STEP (MANDATORY):
After generating both the question and objectives:
1. Check if your solution objectives logically correspond to your variant question
2. Verify that any numeric answers in objectives match the numbers/context in your question
3. Verify that any formulas or calculations in objectives use the correct values from your question
4. If you detect ANY mismatch or inconsistency, populate the validationError field with a description
5. If the objectives perfectly correspond to the question, leave validationError empty/omitted

Generate the similar question, adapted marking objectives, and perform validation.`,
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

    return {
      questionText: output.questionText,
      summary: output.summary,
      solutionObjectives: output.solutionObjectives,
    };
  }, input);

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  console.log(`[Process C] Similar question generated in ${duration}s`);

  return result;
}
