'use server';

/**
 * @fileOverview Batch extraction of geometric diagrams from multiple questions in a single API call.
 *
 * - extractGeometricDiagramsBatch - Analyzes multiple questions and returns geometric representations
 * - Much more efficient than calling extractGeometricDiagram separately for each question
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

const QuestionInputSchema = z.object({
  questionId: z.string().describe('Unique identifier for this question'),
  questionText: z.string().describe('The complete text of the question'),
});

const QuestionDiagramResultSchema = z.object({
  questionId: z.string().describe('The question identifier'),
  hasDiagram: z.boolean().describe('Whether the question contains a mathematically/scientifically relevant diagram'),
  diagram: GeometricDiagramSchema.optional().describe('The geometric representation if a diagram exists'),
});

const ExtractGeometricDiagramsBatchInputSchema = z.object({
  questions: z.array(QuestionInputSchema).describe('Array of questions to analyze'),
  examPaperDataUri: z.string().describe('The exam paper PDF as a data URI containing all questions'),
});

const ExtractGeometricDiagramsBatchOutputSchema = z.object({
  results: z.array(QuestionDiagramResultSchema).describe('Array of diagram extraction results, one per question'),
});

export type ExtractGeometricDiagramsBatchInput = z.infer<typeof ExtractGeometricDiagramsBatchInputSchema>;
export type ExtractGeometricDiagramsBatchOutput = z.infer<typeof ExtractGeometricDiagramsBatchOutputSchema>;

/**
 * Extract geometric diagram representations from multiple questions in a single API call.
 * Only extracts diagrams that are relevant to the mathematical/scientific content.
 */
export async function extractGeometricDiagramsBatch(
  input: ExtractGeometricDiagramsBatchInput
): Promise<ExtractGeometricDiagramsBatchOutput> {
  const startTime = Date.now();
  const questionCount = input.questions.length;
  console.log(`[Batch Geometric Extraction] Analyzing ${questionCount} questions for diagrams...`);

  try {
    const result = await geminiApiKeyManager.withKey(async (apiKey) => {
      const aiInstance = genkit({
        plugins: [googleAI({ apiKey })],
        model: 'googleai/gemini-2.5-flash-lite',
      });

      const prompt = aiInstance.definePrompt({
        name: 'extractGeometricDiagramsBatchPrompt',
        input: { schema: ExtractGeometricDiagramsBatchInputSchema },
        output: { schema: ExtractGeometricDiagramsBatchOutputSchema },
        prompt: `You are a mathematical diagram analyzer. Extract geometric diagrams for multiple questions from an exam paper.

COMMAND SYNTAX:

Points (define once, reference everywhere):
  A=(0,0)
  B=(100,50)
  O=(150,150)
  Center=(200,200)      // Use actual coordinates, NOT variables

Lines and Segments:
  Line(A,B)         // Infinite line through A and B
  Segment(A,B)      // Line segment from A to B

Shapes:
  Triangle(A,B,C)
  Rectangle(A,B,C,D)
  Polygon(A,B,C,D,...)  // Any polygon with 3+ points

Circles and Arcs:
  Circle(O,50)          // Center point O, radius 50 (use actual number!)
  Arc(O,50,0,90)        // Center O, radius 50, from 0° to 90°
  Arc(O,100,180,0)      // Semicircle from left to right (180° to 0°)
  // Angles: 0°=right, 90°=up, 180°=left, 270°=down

Labels and Text:
  Label(A,"Point A")
  Label(Midpoint(A,B),"5cm")
  Label(O,"$\\theta$")  // LaTeX supported! Wrap in $...$
  // LaTeX examples: $\\theta$, $\\pi$, $\\frac{1}{2}$, $\\sqrt{2}$, $x_1$, $\\angle ABC$

Helper Functions:
  Midpoint(A,B)         // Returns point halfway between A and B

CRITICAL RULES:
1. NO VARIABLES: Do NOT use Radius=100 or similar. Use actual numbers: Circle(O,100)
2. ALL POINTS MUST BE DEFINED: Before using "Center", you must define it: Center=(200,200)
3. USE CONCRETE VALUES: Arc(Center, Radius, 180, 0) is WRONG. Use Arc(Center, 100, 180, 0)
4. DEFINE BEFORE USE: Every point must be defined with coordinates before being referenced

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
7. If a question has no relevant diagram, return hasDiagram: false for that question
8. Be precise with coordinates, angles, and measurements

METADATA - DESCRIBE EACH DIAGRAM:
For each diagram, provide metadata:
- description: One sentence describing the diagram
- relationships: Important geometric relationships
- variableElements: What can change in variants
- constraints: What MUST be preserved

EXAMPLE:
{
  "width": 400,
  "height": 300,
  "commands": ["A=(50,200)", "B=(250,200)", "C=(250,50)", "Triangle(A,B,C)", ...],
  "metadata": {
    "description": "Right triangle ABC with right angle at B",
    "relationships": ["AB perpendicular to BC", "AB = 6cm", "BC = 4cm"],
    "variableElements": ["AB length can change", "BC length can change"],
    "constraints": ["AB must stay perpendicular to BC", "AC = √(AB² + BC²)"]
  }
}

QUESTIONS TO ANALYZE:
{{#each questions}}
Question {{questionId}}:
{{questionText}}

{{/each}}

Exam paper (containing all questions and diagrams):
{{media url=examPaperDataUri}}

For each question, extract diagram with commands AND metadata. Return results in same order. Use LaTeX in labels.`,
      });

      const flow = aiInstance.defineFlow(
        {
          name: 'extractGeometricDiagramsBatchFlow',
          inputSchema: ExtractGeometricDiagramsBatchInputSchema,
          outputSchema: ExtractGeometricDiagramsBatchOutputSchema,
        },
        async (input) => {
          const response = await prompt(input);
          return response.output ?? { results: [] };
        }
      );

      return await flow(input);
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    const diagramCount = result.results.filter(r => r.hasDiagram).length;
    console.log(`[Batch Geometric Extraction] Completed in ${duration}s - Extracted ${diagramCount}/${questionCount} diagrams`);

    return result;
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.error(`[Batch Geometric Extraction] Error after ${duration}s:`, error);
    throw error;
  }
}
