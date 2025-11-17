'use server';

/**
 * @fileOverview Extracts geometric diagram representations from exam question images.
 *
 * - extractGeometricDiagram - Analyzes a question and returns a geometric representation if diagrams are present
 * - Uses Gemini 2.5 Flash Lite for efficient extraction
 * - Only extracts mathematically/scientifically relevant diagrams
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'genkit';
import { geminiApiKeyManager } from '@root/gemini-api-key-manager';
import type { GeometricDiagram } from '@/lib/geometric-schema';

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
  label: z.string().describe('Detailed description of this group of entities, including mathematical/scientific context and purpose'),
  entities: z.array(GeometricEntitySchema),
});

const GeometricDiagramSchema = z.object({
  width: z.number().describe('Canvas width in coordinate units'),
  height: z.number().describe('Canvas height in coordinate units'),
  groups: z.array(EntityGroupSchema),
});

const ExtractGeometricDiagramInputSchema = z.object({
  questionText: z.string().describe('The complete text of the question'),
  examPaperDataUri: z.string().describe('The exam paper PDF as a data URI containing the question'),
});

const ExtractGeometricDiagramOutputSchema = z.object({
  hasDiagram: z.boolean().describe('Whether the question contains a mathematically/scientifically relevant diagram'),
  diagram: GeometricDiagramSchema.optional().describe('The geometric representation if a diagram exists'),
});

export type ExtractGeometricDiagramInput = z.infer<typeof ExtractGeometricDiagramInputSchema>;
export type ExtractGeometricDiagramOutput = z.infer<typeof ExtractGeometricDiagramOutputSchema>;

/**
 * Extract geometric diagram representation from an exam question.
 * Only extracts diagrams that are relevant to the mathematical/scientific content.
 */
export async function extractGeometricDiagram(
  input: ExtractGeometricDiagramInput
): Promise<ExtractGeometricDiagramOutput> {
  const startTime = Date.now();
  console.log('[Geometric Extraction] Analyzing question for diagrams...');

  try {
    const result = await geminiApiKeyManager.withKey(async (apiKey) => {
      const aiInstance = genkit({
        plugins: [googleAI({ apiKey })],
        model: 'googleai/gemini-2.5-flash-lite',
      });

      const prompt = aiInstance.definePrompt({
        name: 'extractGeometricDiagramPrompt',
        input: { schema: ExtractGeometricDiagramInputSchema },
        output: { schema: ExtractGeometricDiagramOutputSchema },
        prompt: `You are a mathematical diagram analyzer. Your task is to extract geometric representations of diagrams from exam questions.

GEOMETRIC SCHEMA:
- Represent diagrams using three primitive types: lines, arcs, and text
- Lines: straight segments between two points
- Arcs: curved segments defined by center, radius, and start/end angles (0° = right, counterclockwise)
- Text: plain text positioned at a point (NO LaTeX, NO special formatting)

COORDINATE SYSTEM:
- Use a coordinate system with origin at top-left
- X increases rightward, Y increases downward
- Choose width/height to fit the diagram naturally (e.g., 400x300 for a typical graph)
- Use integer or simple decimal coordinates

ENTITY GROUPS:
- Organize related entities into labeled groups
- Labels should be detailed and descriptive, including:
  * Shape names and properties (e.g., "right triangle ABC with 90° angle at C")
  * Mathematical context (e.g., "parabola y = x^2 with vertex at origin")
  * Purpose (e.g., "coordinate axes with unit markings")
  * Relationships between parts (e.g., "tangent line touching circle at point P")

EXTRACTION RULES:
1. ONLY extract diagrams that are mathematically or scientifically relevant to the question
2. IGNORE decorative images, logos, or irrelevant graphics
3. If no relevant diagram exists, return hasDiagram: false
4. Be precise with measurements and angles
5. Use clear, descriptive group labels to provide context for diagram modification

Question text:
{{questionText}}

Exam paper (containing the question and any diagrams):
{{media url=examPaperDataUri}}

Analyze this question and determine if it contains any mathematically or scientifically relevant diagrams.

If a relevant diagram exists:
1. Extract its geometric representation using lines, arcs, and text entities
2. Organize entities into labeled groups with detailed descriptions
3. Choose appropriate canvas dimensions
4. Use precise coordinates and measurements

If no relevant diagram exists, return hasDiagram: false.`,
      });

      const flow = aiInstance.defineFlow(
        {
          name: 'extractGeometricDiagramFlow',
          inputSchema: ExtractGeometricDiagramInputSchema,
          outputSchema: ExtractGeometricDiagramOutputSchema,
        },
        async (input) => {
          const response = await prompt(input);
          return response.output ?? { hasDiagram: false };
        }
      );

      return await flow(input);
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    if (result.hasDiagram && result.diagram) {
      const entityCount = result.diagram.groups.reduce((sum, g) => sum + g.entities.length, 0);
      console.log(`[Geometric Extraction] Completed in ${duration}s - Extracted diagram with ${result.diagram.groups.length} groups, ${entityCount} entities`);
    } else {
      console.log(`[Geometric Extraction] Completed in ${duration}s - No diagram found`);
    }

    return result;
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.error(`[Geometric Extraction] Error after ${duration}s:`, error);
    throw error;
  }
}
