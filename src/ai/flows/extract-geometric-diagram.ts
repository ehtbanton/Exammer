'use server';

/**
 * @fileOverview Extracts geometric diagram representations from exam question images.
 *
 * - extractGeometricDiagram - Analyzes a question and returns a geometric representation if diagrams are present
 * - Uses Gemini 2.5 Flash Lite for efficient extraction
 * - Only extracts mathematically/scientifically relevant diagrams
 * - Uses command-based schema similar to GeoGebra but simplified
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'genkit';
import { geminiApiKeyManager } from '@root/gemini-api-key-manager';
import type { GeometricDiagram, GeometricConstraint, DiagramSemanticInfo } from '@/lib/geometric-schema';

// Simplified schema for Gemini API compatibility
// Using arrays of strings to avoid complex nested structures
const DiagramMetadataSchema = z.object({
  description: z.string().optional().describe('High-level description of the diagram'),
  relationships: z.array(z.string()).optional().describe('Geometric relationships that are important'),
  variableElements: z.array(z.string()).optional().describe('Elements that can be changed in variants'),
  constraints: z.array(z.string()).optional().describe('Constraints that must be preserved'),
});

const GeometricDiagramSchema = z.object({
  width: z.number().describe('Canvas width in coordinate units'),
  height: z.number().describe('Canvas height in coordinate units'),
  commands: z.array(z.string()).describe('Array of geometric command strings'),
  metadata: DiagramMetadataSchema.optional().describe('Semantic metadata about geometric relationships'),
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
        prompt: `You are a mathematical diagram analyzer. Extract geometric diagrams as a sequence of declarative commands.

COMMAND SYNTAX:

Points (define once, reference everywhere):
  A=(0,0)
  B=(100,50)
  O=(150,150)

Lines and Segments:
  Line(A,B)         // Infinite line through A and B
  Segment(A,B)      // Line segment from A to B

Shapes:
  Triangle(A,B,C)
  Rectangle(A,B,C,D)
  Polygon(A,B,C,D,...)  // Any polygon with 3+ points

Circles and Arcs:
  Circle(O,50)          // Center point O, radius 50
  Arc(O,50,0,90)        // Center O, radius 50, from 0° to 90°
  // Angles: 0°=right, 90°=up, 180°=left, 270°=down

Labels and Text:
  Label(A,"Point A")
  Label(Midpoint(A,B),"5cm")
  Label(O,"$\\theta$")  // LaTeX supported! Wrap in $...$
  // LaTeX examples: $\\theta$, $\\pi$, $\\frac{1}{2}$, $\\sqrt{2}$, $x_1$, $\\angle ABC$

Helper Functions:
  Midpoint(A,B)         // Returns point halfway between A and B

COORDINATE SYSTEM:
- Origin at top-left
- X increases rightward, Y increases downward
- Choose width/height to naturally fit the diagram (e.g., 400x300)
- Use integer or simple decimal coordinates

EXTRACTION GUIDELINES:
1. Start by defining all key points
2. Then draw shapes, lines, circles, arcs
3. Finally add labels and text annotations
4. Use LaTeX notation for mathematical symbols in labels
5. ONLY extract mathematically/scientifically relevant diagrams
6. IGNORE decorative images, logos, or irrelevant graphics
7. If no relevant diagram exists, return hasDiagram: false
8. Be precise with coordinates, angles, and measurements

METADATA - DESCRIBE THE DIAGRAM SEMANTICALLY:
After extracting commands, provide metadata describing the geometric meaning:

metadata.description: One sentence describing what the diagram shows
  Example: "A right triangle ABC with angle B = 90°"
  Example: "Triangle PQR inscribed in a circle with PQ as diameter"

metadata.relationships: List important geometric relationships you observe
  Example: "PQ is the diameter of the circle"
  Example: "Angle PRQ = 90° because it's inscribed in a semicircle"
  Example: "AB is perpendicular to BC (right angle at B)"
  Example: "Segments AB and BC have equal length (both 5cm)"

metadata.variableElements: List what can be changed in variants
  Example: "PQ diameter length can change (currently 22cm in both question text and diagram label)"
  Example: "Angle QPR can change (currently 35° in both question text and diagram label)"
  Example: "BC length can change (currently 15cm - appears in question text AND Label(Midpoint(B,C), '15 cm'))"
  IMPORTANT: If a value appears in both question text and diagram, mention BOTH locations

metadata.constraints: List what MUST be preserved in variants
  Example: "Angle PRQ must remain 90° (appears in question text and should appear in diagram)"
  Example: "PQ must remain the diameter"
  Example: "AB must stay perpendicular to BC"
  Example: "Triangle must remain inscribed in circle"
  Example: "If BC value changes, it must change in BOTH question text and diagram label"

EXAMPLE:
For a right triangle with labeled vertices and sides:
{
  "width": 400,
  "height": 300,
  "commands": [
    "A=(50,200)",
    "B=(250,200)",
    "C=(250,50)",
    "Triangle(A,B,C)",
    "Label(A,\"A\")",
    "Label(B,\"B\")",
    "Label(C,\"C\")",
    "Label(Midpoint(A,B),\"6cm\")",
    "Label(Midpoint(B,C),\"4cm\")",
    "Label(Midpoint(C,A),\"$\\\\sqrt{52}$ cm\")"
  ],
  "metadata": {
    "description": "Right triangle ABC with right angle at B",
    "relationships": [
      "AB is horizontal (base)",
      "BC is vertical (height)",
      "AB and BC are perpendicular (right angle at B)",
      "AB length is 6cm (shown in both question text and Label(Midpoint(A,B), '6cm'))",
      "BC length is 4cm (shown in both question text and Label(Midpoint(B,C), '4cm'))",
      "AC (hypotenuse) length is √52 cm by Pythagoras (shown in Label(Midpoint(C,A), '$\\\\sqrt{52}$ cm'))"
    ],
    "variableElements": [
      "AB length can change (currently 6cm in question text and diagram label - MUST update BOTH)",
      "BC length can change (currently 4cm in question text and diagram label - MUST update BOTH)",
      "Overall scale can change"
    ],
    "constraints": [
      "AB must remain horizontal",
      "BC must remain vertical",
      "AB and BC must stay perpendicular (right angle at B)",
      "AC length must equal √(AB² + BC²)",
      "If AB or BC changes, update the value in BOTH question text and corresponding diagram label"
    ]
  }
}

Question text:
{{questionText}}

Exam paper (containing the question and any diagrams):
{{media url=examPaperDataUri}}

Analyze this question. Extract diagram with commands AND metadata describing geometric relationships. If no relevant diagram exists, return hasDiagram: false.`,
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
      const commandCount = result.diagram.commands.length;
      console.log(`[Geometric Extraction] Completed in ${duration}s - Extracted diagram with ${commandCount} commands`);
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
