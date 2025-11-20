'use server';

/**
 * @fileOverview Generates a similar question variant with modified geometric diagrams.
 *
 * - generateSimilarQuestion - Creates a new question similar in structure and content
 * - Modifies geometric diagrams using command-based schema
 */

import {z} from 'genkit';
import {executeWithManagedKey} from '@/ai/genkit';
import type {GeometricDiagram} from '@/lib/geometric-schema';

const GeometricDiagramSchema = z.object({
  width: z.number(),
  height: z.number(),
  commands: z.array(z.string()),
});

const GenerateSimilarQuestionInputSchema = z.object({
  originalQuestionText: z.string(),
  topicName: z.string(),
  topicDescription: z.string(),
  originalObjectives: z.array(z.string()).optional(),
  originalDiagramData: GeometricDiagramSchema.optional().describe('Original diagram as geometric commands'),
});
export type GenerateSimilarQuestionInput = z.infer<typeof GenerateSimilarQuestionInputSchema>;

const GenerateSimilarQuestionOutputSchema = z.object({
  questionText: z.string(),
  summary: z.string(),
  solutionObjectives: z.array(z.string()),
  diagramData: GeometricDiagramSchema.optional().describe('Modified diagram matching the variant question'),
});
export type GenerateSimilarQuestionOutput = z.infer<typeof GenerateSimilarQuestionOutputSchema>;

export async function generateSimilarQuestion(
  input: GenerateSimilarQuestionInput
): Promise<GenerateSimilarQuestionOutput> {
  const startTime = Date.now();
  const hasObjectives = input.originalObjectives && input.originalObjectives.length > 0;
  const hasDiagram = !!input.originalDiagramData;

  console.log('[Question Generation] Starting variant generation...');
  console.log(`[Question Generation] Has markscheme: ${hasObjectives}`);
  console.log(`[Question Generation] Has diagram: ${hasDiagram}`);

  const result = await executeWithManagedKey(async (ai, flowInput) => {
    const prompt = ai.definePrompt({
      name: 'generateSimilarQuestionPrompt',
      input: {schema: GenerateSimilarQuestionInputSchema},
      output: {schema: GenerateSimilarQuestionOutputSchema},
      prompt: `You are an exam question generator. Create variant questions that test the same concepts with different values/contexts.

GEOMETRIC DIAGRAM MODIFICATION:
Diagrams are represented as geometric commands. When modifying, change coordinates, measurements, and labels to match your variant.

Command types:
- Points: A=(0,0), B=(100,50)
- Lines: Line(A,B), Segment(A,B)
- Shapes: Triangle(A,B,C), Rectangle(A,B,C,D), Polygon(...)
- Circles: Circle(O,50) [center, radius]
- Arcs: Arc(O,50,0,90) [center, radius, start°, end°]
- Labels: Label(A,"text"), Label(Midpoint(A,B),"5cm")

When modifying diagrams:
1. Update point coordinates to create different dimensions
2. Change measurements in labels to match new values
3. Maintain the same structure and relationships
4. Keep canvas dimensions appropriate
5. Ensure diagram measurements match question text

OBJECTIVE ADAPTATION:
- If markscheme provided: adapt each objective to match variant values
- If no markscheme: create 3-6 specific marking criteria from the question
- Keep the same number and structure of objectives
- Update all specific values, formulas, and answers

Topic: {{topicName}}
Description: {{topicDescription}}

Original Question:
{{originalQuestionText}}

{{#if originalDiagramData}}
Original Diagram:
Canvas: {{originalDiagramData.width}}x{{originalDiagramData.height}}
Commands: {{originalDiagramData.commands.length}} geometric commands
Example commands from original:
{{#each originalDiagramData.commands}}
  {{this}}
{{/each}}
{{/if}}

{{#if originalObjectives}}
Original Objectives:
{{#each originalObjectives}}
{{@index}}. {{this}}
{{/each}}
{{/if}}

Generate a similar question that:
1. Tests the same concepts with different values/context
2. Maintains the same structure and difficulty
3. {{#if originalDiagramData}}Modifies diagram commands to match new values{{/if}}
4. {{#if originalObjectives}}Adapts objectives to match the variant{{else}}Creates appropriate marking objectives{{/if}}`,
    });

    const response = await prompt(flowInput, {
      model: 'googleai/gemini-2.5-flash-lite',
    });

    const output = response.output;
    if (!output) {
      throw new Error('Failed to generate variant - no output received');
    }

    return output;
  }, input);

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  console.log(`[Question Generation] Variant generated in ${duration}s`);

  return result;
}
