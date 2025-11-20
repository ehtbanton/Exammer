'use server';

/**
 * @fileOverview Generates a similar question variant with modified geometric diagrams.
 *
 * - generateSimilarQuestion - Creates a new question similar in structure and content
 * - Modifies geometric diagrams using command-based schema
 */

import {z} from 'genkit';
import {executeWithManagedKey} from '@/ai/genkit';
import type {GeometricDiagram, GeometricConstraint, DiagramSemanticInfo} from '@/lib/geometric-schema';

// Simplified schema for Gemini API compatibility
// Using arrays of strings to avoid complex nested structures
const DiagramMetadataSchema = z.object({
  description: z.string().optional(),
  relationships: z.array(z.string()).optional(),
  variableElements: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
});

const GeometricDiagramSchema = z.object({
  width: z.number(),
  height: z.number(),
  commands: z.array(z.string()),
  metadata: DiagramMetadataSchema.optional(),
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
- Labels: Label(A,"text"), Label(Midpoint(A,B),"5cm"), Label(O,"$\\theta$") [LaTeX supported!]

When modifying diagrams:
1. READ THE METADATA CAREFULLY - it tells you what can and cannot change
2. PRESERVE all constraints listed in metadata (these are geometric truths)
3. Only modify variableElements listed in metadata (safe to change)
4. Maintain all geometric relationships described in metadata
5. Update point coordinates to match new values while preserving constraints
6. Use LaTeX for mathematical symbols: $\\theta$, $\\pi$, $\\frac{1}{2}$, $\\sqrt{2}$, etc.
7. Include updated metadata for the variant diagram

CRITICAL - VALUE SYNCHRONIZATION:
If a measurement appears in BOTH the question text AND the diagram, they MUST match exactly:
- If question says "BC = 15 cm", the diagram label must show "15 cm" (not 12cm, not 15m, exactly 15 cm)
- If question says "angle ABC = 40°", the diagram label must show "40°"
- If question says "area = 1500 cm³", any area labels in diagram must show "1500 cm³"

VALUE UPDATE CHECKLIST:
1. List all measurements in the original question text (lengths, angles, areas, etc.)
2. Decide which measurements to change for the variant
3. Update those measurements in the question text
4. Find the corresponding labels in diagram commands (e.g., Label(..., "15 cm"))
5. Update those labels to match the new values EXACTLY
6. Double-check: every measurement in question text must match its diagram label
7. If a value changed, update it EVERYWHERE (question text, diagram labels, objectives, metadata)

EXAMPLE - Correct Value Synchronization:

Original Question: "angle ABC is 40°, and BC = 15 cm"
Original Commands: ["Label(B, \"40°\")", "Label(Midpoint(B,C), \"15 cm\")"]

Variant Question: "angle ABC is 35°, and BC = 12 cm"  ← Changed 40°→35°, 15cm→12cm
Variant Commands: ["Label(B, \"35°\")", "Label(Midpoint(B,C), \"12 cm\")"]  ← MUST match!

WRONG (values don't match):
Variant Question: "angle ABC is 35°, and BC = 12 cm"
Variant Commands: ["Label(B, \"40°\")", "Label(Midpoint(B,C), \"15 cm\")"]  ← Still has old values!

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

{{#if originalDiagramData.metadata}}
DIAGRAM METADATA (CRITICAL - USE THIS TO GUIDE MODIFICATIONS):

Description: {{originalDiagramData.metadata.description}}

{{#if originalDiagramData.metadata.relationships}}
Geometric Relationships:
{{#each originalDiagramData.metadata.relationships}}
  - {{this}}
{{/each}}
{{/if}}

{{#if originalDiagramData.metadata.variableElements}}
What CAN Change (safe to modify):
{{#each originalDiagramData.metadata.variableElements}}
  - {{this}}
{{/each}}
{{/if}}

{{#if originalDiagramData.metadata.constraints}}
What MUST BE PRESERVED (do not break these):
{{#each originalDiagramData.metadata.constraints}}
  - {{this}}
{{/each}}
{{/if}}
{{/if}}
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
3. {{#if originalDiagramData}}{{#if originalDiagramData.metadata}}Modifies diagram while PRESERVING all constraints from metadata{{else}}Modifies diagram commands to match new values{{/if}}{{/if}}
4. {{#if originalObjectives}}Adapts objectives to match the variant{{else}}Creates appropriate marking objectives{{/if}}
5. Uses LaTeX notation in diagram labels for mathematical symbols
6. {{#if originalDiagramData.metadata}}Includes updated metadata describing the variant diagram's relationships and constraints{{/if}}`,
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
