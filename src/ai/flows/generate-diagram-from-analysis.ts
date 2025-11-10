'use server';

/**
 * @fileOverview Generates accurate diagram images from structured analysis data.
 *
 * Takes the detailed diagram analysis and creates precise recreations using either
 * Imagen or Mermaid, with exact values and measurements preserved.
 */

import {GoogleGenerativeAI} from '@google/genai';
import type {DiagramAnalysis} from './analyze-diagram-detailed';

/**
 * Builds a hyper-detailed Imagen prompt from structured diagram analysis
 */
function buildDetailedImagenPrompt(analysis: DiagramAnalysis): string {
  const parts: string[] = [];

  // Start with diagram type and overall description
  parts.push(`Create a ${analysis.diagramType.replace('_', ' ')} diagram.`);
  parts.push(analysis.description);

  // Add style specification based on accuracy requirement
  if (analysis.accuracyRequirement === 'exact' || analysis.accuracyRequirement === 'high') {
    parts.push('\nSTYLE: Clean, precise technical diagram with clear labels and exact measurements.');
    parts.push('Use a simple white or light background.');
    parts.push('All measurements and values must be clearly visible and legible.');
  }

  // Add elements
  if (analysis.elements.length > 0) {
    parts.push('\nELEMENTS:');
    analysis.elements.forEach(element => {
      let elementDesc = `- ${element.label}`;
      if (element.properties) {
        const props = Object.entries(element.properties)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        elementDesc += ` (${props})`;
      }
      parts.push(elementDesc);
    });
  }

  // Add connections with exact measurements
  if (analysis.connections.length > 0) {
    parts.push('\nCONNECTIONS:');
    analysis.connections.forEach(conn => {
      const fromLabel = analysis.elements.find(e => e.id === conn.from)?.label || conn.from;
      const toLabel = analysis.elements.find(e => e.id === conn.to)?.label || conn.to;

      let connDesc = `- Connect ${fromLabel} to ${toLabel}`;

      if (conn.value) {
        connDesc += ` with measurement: ${conn.value}`;
      } else if (conn.label) {
        connDesc += ` labeled: ${conn.label}`;
      }

      if (conn.type) {
        connDesc += ` (${conn.type})`;
      }

      parts.push(connDesc);
    });
  }

  // Add ALL measurements (this is critical)
  if (analysis.measurements) {
    if (analysis.measurements.lengths && analysis.measurements.lengths.length > 0) {
      parts.push('\nLENGTH MEASUREMENTS (EXACT):');
      analysis.measurements.lengths.forEach(length => {
        parts.push(`- ${length}`);
      });
    }

    if (analysis.measurements.angles && analysis.measurements.angles.length > 0) {
      parts.push('\nANGLE MEASUREMENTS (EXACT):');
      analysis.measurements.angles.forEach(angle => {
        parts.push(`- ${angle}`);
      });
    }

    if (analysis.measurements.areas && analysis.measurements.areas.length > 0) {
      parts.push('\nAREA MEASUREMENTS:');
      analysis.measurements.areas.forEach(area => {
        parts.push(`- ${area}`);
      });
    }

    if (analysis.measurements.other && analysis.measurements.other.length > 0) {
      parts.push('\nOTHER MEASUREMENTS:');
      analysis.measurements.other.forEach(measurement => {
        parts.push(`- ${measurement}`);
      });
    }
  }

  // Add annotations
  if (analysis.annotations.length > 0) {
    parts.push('\nLABELS AND ANNOTATIONS:');
    analysis.annotations.forEach(annotation => {
      parts.push(`- ${annotation.text}${annotation.value ? ` (value: ${annotation.value})` : ''}`);
    });
  }

  // Add mathematical constraints
  if (analysis.mathematicalProperties) {
    if (analysis.mathematicalProperties.constraints && analysis.mathematicalProperties.constraints.length > 0) {
      parts.push('\nCONSTRAINTS:');
      analysis.mathematicalProperties.constraints.forEach(constraint => {
        parts.push(`- ${constraint}`);
      });
    }

    if (analysis.mathematicalProperties.formulas && analysis.mathematicalProperties.formulas.length > 0) {
      parts.push('\nFORMULAS:');
      analysis.mathematicalProperties.formulas.forEach(formula => {
        parts.push(`- ${formula}`);
      });
    }
  }

  // Add visual styling
  if (analysis.visualProperties) {
    const visualParts: string[] = [];

    if (analysis.visualProperties.colors && analysis.visualProperties.colors.length > 0) {
      visualParts.push(`Colors: ${analysis.visualProperties.colors.join(', ')}`);
    }

    if (analysis.visualProperties.styles && analysis.visualProperties.styles.length > 0) {
      visualParts.push(`Styles: ${analysis.visualProperties.styles.join(', ')}`);
    }

    if (analysis.visualProperties.orientation) {
      visualParts.push(`Orientation: ${analysis.visualProperties.orientation}`);
    }

    if (visualParts.length > 0) {
      parts.push('\nVISUAL PROPERTIES:');
      parts.push(visualParts.join(', '));
    }
  }

  // Final instruction for accuracy
  if (analysis.accuracyRequirement === 'exact' || analysis.accuracyRequirement === 'high') {
    parts.push('\nIMPORTANT: All measurements, angles, and values shown above MUST be represented exactly as specified. This is a mathematical/technical diagram where precision is critical.');
  }

  return parts.join('\n');
}

/**
 * Builds precise Mermaid syntax from structured diagram analysis
 */
function buildDetailedMermaidSyntax(analysis: DiagramAnalysis): string | null {
  // Only generate Mermaid for suitable diagram types
  const mermaidSuitable = [
    'flowchart',
    'graph_network',
    'tree_structure',
  ];

  if (!mermaidSuitable.includes(analysis.diagramType)) {
    return null;
  }

  const lines: string[] = [];

  // Determine Mermaid diagram type
  if (analysis.diagramType === 'flowchart') {
    lines.push('flowchart TD');
  } else if (analysis.diagramType === 'tree_structure') {
    lines.push('graph TD');
  } else {
    // Default to graph
    const orientation = analysis.visualProperties?.orientation?.includes('horizontal') ? 'LR' : 'TD';
    lines.push(`graph ${orientation}`);
  }

  // Add elements as nodes
  analysis.elements.forEach(element => {
    const label = element.label || element.id;
    lines.push(`    ${element.id}["${label}"]`);
  });

  // Add connections as edges
  analysis.connections.forEach(conn => {
    const label = conn.label || conn.value || '';
    if (label) {
      lines.push(`    ${conn.from} -->|"${label}"| ${conn.to}`);
    } else {
      lines.push(`    ${conn.from} --> ${conn.to}`);
    }
  });

  return lines.join('\n');
}

export interface GenerateDiagramFromAnalysisInput {
  analysis: DiagramAnalysis;
  method?: 'imagen' | 'mermaid' | 'auto';
  aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
}

export interface GenerateDiagramFromAnalysisOutput {
  imageUri?: string; // Base64 data URI from Imagen
  mermaidCode?: string; // Mermaid syntax
  method: 'imagen' | 'mermaid';
  prompt?: string; // The detailed prompt used (for debugging)
}

/**
 * Generates a diagram image from detailed analysis data.
 * Uses the structured information to create accurate recreations with exact values.
 */
export async function generateDiagramFromAnalysis(
  input: GenerateDiagramFromAnalysisInput
): Promise<GenerateDiagramFromAnalysisOutput> {
  const { analysis, method = 'auto', aspectRatio = '1:1' } = input;

  console.log(`[Diagram Generation] Generating from analysis - Type: ${analysis.diagramType}, Method: ${method}`);
  const startTime = Date.now();

  try {
    // Determine which method to use
    let selectedMethod: 'imagen' | 'mermaid';

    if (method === 'auto') {
      // Use recommendation from analysis
      if (analysis.recommendedRenderMethod === 'mermaid_suitable') {
        selectedMethod = 'mermaid';
      } else {
        // Default to Imagen for most cases, especially those requiring accuracy
        selectedMethod = 'imagen';
      }
    } else {
      selectedMethod = method;
    }

    // Try Mermaid first if requested
    if (selectedMethod === 'mermaid') {
      const mermaidCode = buildDetailedMermaidSyntax(analysis);

      if (mermaidCode) {
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        console.log(`[Diagram Generation] ✓ Generated Mermaid in ${duration}s`);

        return {
          mermaidCode,
          method: 'mermaid',
        };
      }

      // If Mermaid failed, fall back to Imagen
      console.log('[Diagram Generation] Mermaid not suitable, falling back to Imagen');
      selectedMethod = 'imagen';
    }

    // Generate with Imagen using detailed prompt
    const detailedPrompt = buildDetailedImagenPrompt(analysis);
    console.log('[Diagram Generation] Using detailed Imagen prompt:', detailedPrompt);

    const apiKey = process.env.GEMINI_API_KEY_BILLED;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY_BILLED not found in environment variables');
    }

    const ai = new GoogleGenerativeAI(apiKey);

    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: detailedPrompt,
      config: {
        numberOfImages: 1,
        aspectRatio: aspectRatio,
        personGeneration: 'dont_allow',
      },
    });

    if (!response.generatedImages || response.generatedImages.length === 0) {
      throw new Error('No images generated by Imagen');
    }

    const image = response.generatedImages[0];
    const mimeType = image.mimeType || 'image/png';
    const imageUri = `data:${mimeType};base64,${image.image.bytesBase64Encoded}`;

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`[Diagram Generation] ✓ Generated Imagen in ${duration}s`);

    return {
      imageUri,
      method: 'imagen',
      prompt: detailedPrompt,
    };

  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.error(`[Diagram Generation] ✗ Error after ${duration}s:`, error);
    throw error;
  }
}
