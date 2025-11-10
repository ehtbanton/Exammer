'use server';

/**
 * @fileOverview Analyzes diagram images from exam papers to extract precise, structured data.
 *
 * This flow takes a diagram image and provides detailed extraction of all measurements,
 * labels, values, angles, coordinates, and relationships - ensuring mathematical accuracy.
 */

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {z} from 'genkit';
import {geminiApiKeyManager} from '@root/gemini-api-key-manager';

/**
 * Structured representation of a diagram element (node/vertex)
 */
const DiagramElementSchema = z.object({
  id: z.string().describe('Unique identifier for this element (e.g., "A", "B", "Point1")'),
  label: z.string().describe('Display label for this element'),
  x: z.number().optional().describe('X coordinate if applicable (normalized 0-100)'),
  y: z.number().optional().describe('Y coordinate if applicable (normalized 0-100)'),
  propertyData: z.string().optional().describe('Additional properties as JSON string (e.g., color, size, type)'),
});

/**
 * Structured representation of a connection/relationship between elements
 */
const DiagramConnectionSchema = z.object({
  from: z.string().describe('ID of the source element'),
  to: z.string().describe('ID of the target element'),
  label: z.string().optional().describe('Label on the connection (e.g., "5 cm", "60°")'),
  value: z.string().optional().describe('Numeric value with unit (e.g., "5 cm", "60 degrees")'),
  type: z.string().optional().describe('Type of connection (e.g., "edge", "angle", "distance")'),
  propertyData: z.string().optional().describe('Additional properties as JSON string (e.g., style, direction)'),
});

/**
 * Structured representation of text annotations or measurements
 */
const DiagramAnnotationSchema = z.object({
  text: z.string().describe('The annotation text'),
  value: z.string().optional().describe('Extracted numeric value if applicable'),
  position: z.string().optional().describe('Position description (e.g., "top-left", "center")'),
  associatedElements: z.array(z.string()).optional().describe('IDs of elements this annotation relates to'),
});

/**
 * Complete structured diagram analysis
 */
const DiagramAnalysisSchema = z.object({
  diagramType: z.enum([
    'geometric_shape',
    'triangle',
    'graph_network',
    'flowchart',
    'circuit',
    'coordinate_system',
    'bar_chart',
    'pie_chart',
    'venn_diagram',
    'tree_structure',
    'statistical_plot',
    'physics_diagram',
    'chemistry_structure',
    'other'
  ]).describe('The primary type of diagram'),

  description: z.string().describe('Comprehensive description of what the diagram shows'),

  elements: z.array(DiagramElementSchema).describe('All nodes, vertices, points, or objects in the diagram'),

  connections: z.array(DiagramConnectionSchema).describe('All edges, relationships, measurements, or connections between elements'),

  annotations: z.array(DiagramAnnotationSchema).describe('All text labels, measurements, angles, or annotations'),

  measurements: z.object({
    lengths: z.array(z.string()).optional().describe('All length measurements (e.g., ["AB = 5 cm", "BC = 3 cm"])'),
    angles: z.array(z.string()).optional().describe('All angle measurements (e.g., ["∠ABC = 60°", "∠CAB = 45°"])'),
    areas: z.array(z.string()).optional().describe('All area measurements'),
    other: z.array(z.string()).optional().describe('Other measurements or values'),
  }).describe('Structured extraction of all measurements'),

  mathematicalProperties: z.object({
    formulas: z.array(z.string()).optional().describe('Any formulas shown or implied'),
    constraints: z.array(z.string()).optional().describe('Constraints or conditions (e.g., "right angle at B")'),
    relationships: z.array(z.string()).optional().describe('Mathematical relationships between elements'),
  }).optional().describe('Mathematical properties if applicable'),

  visualProperties: z.object({
    colors: z.array(z.string()).optional().describe('Colors used in the diagram'),
    styles: z.array(z.string()).optional().describe('Visual styles (solid, dashed, bold, etc.)'),
    orientation: z.string().optional().describe('Overall orientation (horizontal, vertical, radial, etc.)'),
  }).optional().describe('Visual styling information'),

  complexityScore: z.number().min(1).max(10).describe('Complexity rating: 1=very simple (single shape), 10=very complex (many interconnected elements)'),

  accuracyRequirement: z.enum(['low', 'medium', 'high', 'exact']).describe('How precisely values must be represented: low=approximate, exact=must be pixel-perfect'),

  recommendedRenderMethod: z.enum(['original_only', 'mermaid_suitable', 'imagen_suitable', 'both_possible']).describe('Best rendering approach based on diagram characteristics'),

  reasoning: z.string().describe('Explanation of why this render method is recommended'),
});

const AnalyzeDiagramDetailedInputSchema = z.object({
  diagramDataUri: z.string().describe("Diagram image as data URI (data:image/png;base64,...)"),
  questionContext: z.string().optional().describe("The question text for additional context"),
  subject: z.string().optional().describe("Subject area (e.g., 'Mathematics', 'Physics', 'Chemistry')"),
});

export type AnalyzeDiagramDetailedInput = z.infer<typeof AnalyzeDiagramDetailedInputSchema>;
export type DiagramAnalysis = z.infer<typeof DiagramAnalysisSchema>;

/**
 * Analyzes a diagram image and extracts detailed structured data about all elements,
 * measurements, relationships, and properties.
 */
export async function analyzeDiagramDetailed(
  input: AnalyzeDiagramDetailedInput
): Promise<DiagramAnalysis> {
  const { diagramDataUri, questionContext, subject } = input;

  console.log('[Diagram Analysis] Starting detailed analysis...');
  const startTime = Date.now();

  try {
    const result = await geminiApiKeyManager.withKey(async (apiKey) => {
      const aiInstance = genkit({
        plugins: [googleAI({ apiKey })],
        model: 'googleai/gemini-2.0-flash-exp',
      });

      const prompt = aiInstance.definePrompt({
        name: 'analyzeDiagramDetailedPrompt',
        input: { schema: AnalyzeDiagramDetailedInputSchema },
        output: { schema: DiagramAnalysisSchema },
        prompt: `TASK: Perform comprehensive, mathematically precise analysis of this diagram.

{{#if subject}}
SUBJECT: {{subject}}
{{/if}}

{{#if questionContext}}
QUESTION CONTEXT: {{questionContext}}
{{/if}}

DIAGRAM:
{{media url=diagramDataUri}}

ANALYSIS REQUIREMENTS:

You are analyzing a diagram from an exam paper. Your goal is to extract EVERY piece of information with mathematical precision.

1. DIAGRAM TYPE IDENTIFICATION
   - Identify the primary diagram type from the provided enum
   - For mathematical diagrams, be specific (triangle vs general geometric_shape)
   - For graphs/networks, distinguish between graph_network and flowchart

2. ELEMENT EXTRACTION
   Extract EVERY visible element:
   - Points, vertices, nodes (labeled A, B, C, or Point1, Point2, etc.)
   - Objects, shapes, components
   - For each element, provide:
     * Unique ID (use the diagram's labels if present)
     * Display label (exactly as shown)
     * Position if relevant (normalized coordinates 0-100)
     * Any properties (color, size, type, etc.)

3. CONNECTION EXTRACTION
   Extract EVERY connection, edge, or relationship:
   - Lines, edges, arrows between elements
   - For each connection, capture:
     * Source and target element IDs
     * ANY label on the connection
     * EXACT numeric values with units (e.g., "5 cm", "60°")
     * Type (edge, angle, distance, etc.)
     * Visual properties (dashed, solid, arrow, etc.)

4. MEASUREMENT EXTRACTION
   This is CRITICAL for accuracy:
   - Lengths: Extract ALL length measurements with exact values and units
     Example: ["AB = 5 cm", "BC = 3 cm", "AC = 4 cm"]
   - Angles: Extract ALL angle measurements with exact values
     Example: ["∠ABC = 90°", "∠BAC = 60°", "∠BCA = 30°"]
   - Areas, volumes, or other measurements
   - If a measurement is shown on the diagram, it MUST be captured

5. ANNOTATION EXTRACTION
   Extract ALL text labels, equations, or annotations:
   - Axis labels, scale indicators
   - Equations or formulas shown
   - Legend text
   - Any other text visible in the diagram

6. MATHEMATICAL PROPERTIES
   For mathematical diagrams:
   - Formulas: Any equations shown or clearly implied
   - Constraints: Special properties (right angle, parallel lines, equal sides, etc.)
   - Relationships: Dependencies between elements (e.g., "AC² = AB² + BC²")

7. ACCURACY REQUIREMENT ASSESSMENT
   Determine precision needs:
   - exact: Math problems with specific numerical values (triangle with sides 3,4,5)
   - high: Physics/chemistry with measurements (circuit with resistors)
   - medium: Conceptual diagrams with some quantitative aspects
   - low: Flowcharts, concept maps, general illustrations

8. RENDER METHOD RECOMMENDATION
   Based on the diagram:
   - original_only: Complex diagrams where regeneration will lose accuracy (photos, detailed anatomical, complex physics apparatus)
   - mermaid_suitable: Diagrams that map well to Mermaid syntax (simple flowcharts, simple graphs, basic network diagrams)
   - imagen_suitable: Diagrams that need AI generation but not suitable for Mermaid (geometric shapes with precise measurements, custom scientific diagrams)
   - both_possible: Could work with either Mermaid or Imagen

CRITICAL RULES:
- NEVER approximate or guess values - if a measurement says "5 cm", record "5 cm" exactly
- NEVER omit measurements, even if they seem redundant
- If you see "60°", record "60 degrees" or "60°" with the exact symbol used
- Capture ALL elements, even if there are many
- For triangles: extract ALL three sides, ALL three angles, ALL vertices
- For graphs: extract ALL nodes and ALL edges with their labels

OUTPUT FORMAT:
Return complete structured analysis with all fields populated.`,
      });

      const flow = aiInstance.defineFlow(
        {
          name: 'analyzeDiagramDetailedFlow',
          inputSchema: AnalyzeDiagramDetailedInputSchema,
          outputSchema: DiagramAnalysisSchema,
        },
        async (flowInput) => {
          const response = await prompt(flowInput);

          if (!response.output) {
            throw new Error('No output received from diagram analysis');
          }

          return response.output;
        }
      );

      return await flow({
        diagramDataUri,
        questionContext,
        subject,
      });
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`[Diagram Analysis] ✓ Completed in ${duration}s - Type: ${result.diagramType}, Complexity: ${result.complexityScore}/10, Recommended: ${result.recommendedRenderMethod}`);

    return result;
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.error(`[Diagram Analysis] ✗ Error after ${duration}s:`, error);
    throw error;
  }
}
