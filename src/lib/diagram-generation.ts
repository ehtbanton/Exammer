/**
 * @fileOverview Improved diagram generation utilities that use detailed diagram data
 * for accurate recreation with exact measurements.
 */

import type { DiagramDetailedData } from './types';

/**
 * Builds a comprehensive, measurement-precise Imagen prompt from detailed diagram data.
 * This ensures all exact values, measurements, and relationships are preserved.
 */
export function buildAccurateImagenPrompt(detailedData: DiagramDetailedData): string {
  const parts: string[] = [];

  // Start with diagram type
  parts.push(`Create a clean, precise ${detailedData.type.replace('_', ' ')} diagram.`);
  parts.push('Style: Technical/educational diagram with clear labels, clean lines, and legible text.');
  parts.push('Background: White or light background for maximum clarity.');

  // Add elements/vertices/points
  if (detailedData.elements && detailedData.elements.length > 0) {
    parts.push('\nELEMENTS/POINTS:');
    detailedData.elements.forEach(element => {
      let desc = `- ${element.label}`;
      if (element.type) {
        desc += ` (${element.type})`;
      }
      parts.push(desc);
    });
  }

  // Add connections/edges/relationships WITH EXACT MEASUREMENTS
  if (detailedData.connections && detailedData.connections.length > 0) {
    parts.push('\nCONNECTIONS:');
    detailedData.connections.forEach(conn => {
      const fromLabel = detailedData.elements?.find(e => e.id === conn.from)?.label || conn.from;
      const toLabel = detailedData.elements?.find(e => e.id === conn.to)?.label || conn.to;

      let desc = `- From ${fromLabel} to ${toLabel}`;
      if (conn.label) {
        desc += ` labeled "${conn.label}"`;
      }
      if (conn.type) {
        desc += ` (type: ${conn.type})`;
      }
      parts.push(desc);
    });
  }

  // CRITICAL: Add ALL measurements with exact values
  if (detailedData.measurements) {
    if (detailedData.measurements.lengths && detailedData.measurements.lengths.length > 0) {
      parts.push('\nLENGTHS (EXACT - DO NOT APPROXIMATE):');
      detailedData.measurements.lengths.forEach(length => {
        parts.push(`- ${length}`);
      });
    }

    if (detailedData.measurements.angles && detailedData.measurements.angles.length > 0) {
      parts.push('\nANGLES (EXACT - DO NOT APPROXIMATE):');
      detailedData.measurements.angles.forEach(angle => {
        parts.push(`- ${angle}`);
      });
    }

    if (detailedData.measurements.other && detailedData.measurements.other.length > 0) {
      parts.push('\nOTHER MEASUREMENTS (EXACT):');
      detailedData.measurements.other.forEach(measurement => {
        parts.push(`- ${measurement}`);
      });
    }
  }

  // Add all labels and annotations
  if (detailedData.labels && detailedData.labels.length > 0) {
    parts.push('\nLABELS/ANNOTATIONS:');
    detailedData.labels.forEach(label => {
      parts.push(`- ${label}`);
    });
  }

  // Add special properties (right angles, parallel lines, etc.)
  if (detailedData.specialProperties && detailedData.specialProperties.length > 0) {
    parts.push('\nSPECIAL PROPERTIES:');
    detailedData.specialProperties.forEach(prop => {
      parts.push(`- ${prop}`);
    });
  }

  // Final critical instruction
  parts.push('\nCRITICAL REQUIREMENTS:');
  parts.push('- ALL measurements and values listed above MUST be shown exactly as specified');
  parts.push('- This is a mathematical/educational diagram where precision is essential');
  parts.push('- Use clean, professional styling suitable for educational materials');
  parts.push('- Ensure all text is legible and clearly visible');

  return parts.join('\n');
}

/**
 * Builds precise Mermaid code from detailed diagram data.
 * Only suitable for certain diagram types (flowcharts, simple graphs, etc.)
 */
export function buildAccurateMermaidCode(detailedData: DiagramDetailedData): string | null {
  // Only generate Mermaid for suitable types
  const mermaidSuitableTypes = [
    'flowchart',
    'flow_chart',
    'graph',
    'network',
    'tree',
    'hierarchy',
  ];

  const isSuitable = mermaidSuitableTypes.some(type =>
    detailedData.type.toLowerCase().includes(type.toLowerCase())
  );

  if (!isSuitable) {
    return null;
  }

  const lines: string[] = [];

  // Determine diagram type
  if (detailedData.type.toLowerCase().includes('flowchart') ||
      detailedData.type.toLowerCase().includes('flow')) {
    lines.push('flowchart TD');
  } else {
    lines.push('graph TD');
  }

  // Add elements as nodes
  if (detailedData.elements) {
    detailedData.elements.forEach(element => {
      const label = element.label || element.id;
      lines.push(`    ${element.id}["${label}"]`);
    });
  }

  // Add connections as edges
  if (detailedData.connections) {
    detailedData.connections.forEach(conn => {
      const label = conn.label || '';
      if (label) {
        lines.push(`    ${conn.from} -->|"${label}"| ${conn.to}`);
      } else {
        lines.push(`    ${conn.from} --> ${conn.to}`);
      }
    });
  }

  return lines.join('\n');
}

/**
 * Determines if a diagram is suitable for Mermaid rendering based on its detailed data.
 */
export function isMermaidSuitable(detailedData: DiagramDetailedData): boolean {
  const mermaidSuitableTypes = [
    'flowchart',
    'flow_chart',
    'graph_network',
    'tree_structure',
    'hierarchy',
  ];

  const hasPreciseMeasurements =
    (detailedData.measurements?.lengths && detailedData.measurements.lengths.length > 0) ||
    (detailedData.measurements?.angles && detailedData.measurements.angles.length > 0);

  // If diagram has precise numerical measurements, it's NOT suitable for Mermaid
  // (Mermaid can't accurately represent "5 cm" or "60 degrees")
  if (hasPreciseMeasurements) {
    return false;
  }

  // Check if type is suitable
  return mermaidSuitableTypes.some(type =>
    detailedData.type.toLowerCase().includes(type.toLowerCase())
  );
}

/**
 * Determines if detailed data is available and complete enough for accurate generation.
 */
export function hasDetailedData(detailedData: DiagramDetailedData | null | undefined): boolean {
  if (!detailedData) return false;

  // Check if it has meaningful data
  const hasElements = detailedData.elements && detailedData.elements.length > 0;
  const hasConnections = detailedData.connections && detailedData.connections.length > 0;
  const hasMeasurements =
    (detailedData.measurements?.lengths && detailedData.measurements.lengths.length > 0) ||
    (detailedData.measurements?.angles && detailedData.measurements.angles.length > 0) ||
    (detailedData.measurements?.other && detailedData.measurements.other.length > 0);

  return hasElements || hasConnections || hasMeasurements;
}
