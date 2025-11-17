'use server';

/**
 * @fileOverview Generates a similar question variant with modified geometric diagrams.
 *
 * - generateSimilarQuestion - Creates a new question similar in structure and content
 * - Modifies geometric diagrams using our custom schema
 */

import {z} from 'genkit';
import {executeWithManagedKey} from '@/ai/genkit';
import type {GeometricDiagram} from '@/lib/geometric-schema';

// Import geometric schema as Zod schema
const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const StyleSchema = z.object({
  color: z.string().optional(),
  width: z.number().optional(),
  dashed: z.boolean().optional(),
});

const TextStyleSchema = z.object({
  color: z.string().optional(),
  size: z.number().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
});

const LineEntitySchema = z.object({
  type: z.literal('line'),
  from: PointSchema,
  to: PointSchema,
  style: StyleSchema.optional(),
});

const ArcEntitySchema = z.object({
  type: z.literal('arc'),
  center: PointSchema,
  radius: z.number(),
  startAngle: z.number(),
  endAngle: z.number(),
  style: StyleSchema.optional(),
});

const TextEntitySchema = z.object({
  type: z.literal('text'),
  position: PointSchema,
  content: z.string(),
  style: TextStyleSchema.optional(),
});

const GeometricEntitySchema = z.discriminatedUnion('type', [
  LineEntitySchema,
  ArcEntitySchema,
  TextEntitySchema,
]);

const EntityGroupSchema = z.object({
  label: z.string(),
  entities: z.array(GeometricEntitySchema),
});

const GeometricDiagramSchema = z.object({
  width: z.number(),
  height: z.number(),
  groups: z.array(EntityGroupSchema),
});

const GenerateSimilarQuestionInputSchema = z.object({
  originalQuestionText: z.string(),
  topicName: z.string(),
  topicDescription: z.string(),
  originalObjectives: z.array(z.string()).optional(),
  originalDiagramData: GeometricDiagramSchema.optional().describe('Original diagram as geometric primitives (lines, arcs, text)'),
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
When modifying diagrams, you work with three primitives:
- Lines: straight segments (from point, to point)
- Arcs: curves (center, radius, start/end angles in degrees, 0° = right, counterclockwise)
- Text: labels (position, content as plain text)

Entity groups have descriptive labels explaining their purpose. Use these labels to understand what to modify and how.

MODIFICATION RULES:
1. Change specific values, measurements, coordinates to match your variant
2. Maintain the same structure and relationships between entities
3. Update entity group labels if the context changes
4. Keep canvas dimensions appropriate for the modified diagram
5. Ensure all measurements in diagrams match the question text

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
{{#each originalDiagramData.groups}}
Group "{{label}}":
{{#each entities}}
  - {{type}}: {{#if (eq type 'line')}}from ({{from.x}}, {{from.y}}) to ({{to.x}}, {{to.y}}){{/if}}{{#if (eq type 'arc')}}center ({{center.x}}, {{center.y}}), radius {{radius}}, {{startAngle}}° to {{endAngle}}°{{/if}}{{#if (eq type 'text')}}"{{content}}" at ({{position.x}}, {{position.y}}){{/if}}
{{/each}}
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
3. {{#if originalDiagramData}}Updates diagram coordinates, measurements, and labels to match new values{{/if}}
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
