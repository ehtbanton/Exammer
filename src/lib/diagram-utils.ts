/**
 * Diagram Utilities
 *
 * This module provides utilities for validating and processing diagrams,
 * including Mermaid syntax validation and diagram type detection.
 */

import type { DiagramType, DiagramStyle } from './types';

/**
 * Validates Mermaid diagram syntax
 * Basic validation - checks for valid diagram types and basic syntax
 */
export function validateMermaidSyntax(mermaidCode: string): { isValid: boolean; error?: string } {
  if (!mermaidCode || mermaidCode.trim().length === 0) {
    return { isValid: false, error: 'Empty mermaid code' };
  }

  const trimmed = mermaidCode.trim();

  // List of supported Mermaid diagram types
  const validDiagramTypes = [
    'graph',
    'flowchart',
    'sequenceDiagram',
    'classDiagram',
    'stateDiagram',
    'stateDiagram-v2',
    'erDiagram',
    'journey',
    'gantt',
    'pie',
    'quadrantChart',
    'requirementDiagram',
    'gitGraph',
    'C4Context',
    'mindmap',
    'timeline',
    'zenuml',
    'sankey-beta',
    'block-beta',
  ];

  // Check if the diagram starts with a valid type
  const startsWithValidType = validDiagramTypes.some(type =>
    trimmed.startsWith(type) || trimmed.startsWith(`\`\`\`mermaid\n${type}`)
  );

  if (!startsWithValidType) {
    return {
      isValid: false,
      error: `Diagram must start with a valid type: ${validDiagramTypes.slice(0, 5).join(', ')}, etc.`
    };
  }

  // Check for basic syntax issues
  // Count opening and closing brackets/parentheses
  const openBrackets = (trimmed.match(/\[/g) || []).length;
  const closeBrackets = (trimmed.match(/\]/g) || []).length;
  const openParens = (trimmed.match(/\(/g) || []).length;
  const closeParens = (trimmed.match(/\)/g) || []).length;
  const openBraces = (trimmed.match(/\{/g) || []).length;
  const closeBraces = (trimmed.match(/\}/g) || []).length;

  if (openBrackets !== closeBrackets) {
    return { isValid: false, error: 'Mismatched square brackets [ ]' };
  }

  if (openParens !== closeParens) {
    return { isValid: false, error: 'Mismatched parentheses ( )' };
  }

  if (openBraces !== closeBraces) {
    return { isValid: false, error: 'Mismatched curly braces { }' };
  }

  // Check if the diagram has at least some content
  const lines = trimmed.split('\n').filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    return { isValid: false, error: 'Diagram must have at least 2 lines (type + content)' };
  }

  return { isValid: true };
}

/**
 * Determines whether a diagram should use Mermaid or Imagen based on complexity
 * Returns recommended diagram type and confidence score
 */
export function detectDiagramType(
  description: string,
  mermaidCode?: string
): {
  recommendedType: DiagramType;
  confidence: number;
  reason: string;
} {
  const descLower = description.toLowerCase();

  // Keywords that suggest Imagen would be better
  const imagenKeywords = [
    'photo', 'photograph', 'picture', 'image',
    'realistic', '3d', 'three-dimensional',
    'detailed illustration', 'anatomical',
    'complex apparatus', 'experimental setup',
    'microscope', 'microscopic',
    'cross-section', 'cross section',
    'landscape', 'scene',
    'shaded', 'shading', 'gradient',
    'textured', 'texture',
  ];

  // Keywords that suggest Mermaid would be better
  const mermaidKeywords = [
    'flowchart', 'flow chart',
    'diagram', 'graph',
    'chart', 'pie chart', 'bar chart',
    'sequence', 'state machine',
    'class diagram', 'er diagram',
    'tree', 'hierarchy',
    'timeline', 'gantt',
    'process', 'workflow',
    'circuit', 'network',
    'relationship',
  ];

  let imagenScore = 0;
  let mermaidScore = 0;

  // Score based on keywords
  imagenKeywords.forEach(keyword => {
    if (descLower.includes(keyword)) {
      imagenScore += 2;
    }
  });

  mermaidKeywords.forEach(keyword => {
    if (descLower.includes(keyword)) {
      mermaidScore += 2;
    }
  });

  // Bonus for having valid Mermaid code
  if (mermaidCode) {
    const validation = validateMermaidSyntax(mermaidCode);
    if (validation.isValid) {
      mermaidScore += 5;
    }
  }

  // Determine recommendation
  if (imagenScore > mermaidScore) {
    return {
      recommendedType: 'imagen',
      confidence: Math.min(imagenScore / (imagenScore + mermaidScore), 0.95),
      reason: 'Description suggests complex visual content better suited for AI image generation',
    };
  } else if (mermaidScore > imagenScore) {
    return {
      recommendedType: 'mermaid',
      confidence: Math.min(mermaidScore / (imagenScore + mermaidScore), 0.95),
      reason: 'Description suggests structured diagram suitable for Mermaid rendering',
    };
  } else {
    // Default to Mermaid for simple diagrams
    return {
      recommendedType: 'mermaid',
      confidence: 0.5,
      reason: 'Neutral description - defaulting to Mermaid for efficiency',
    };
  }
}

/**
 * Determines optimal aspect ratio for a diagram based on description
 */
export function getOptimalAspectRatio(description: string, diagramType?: string): string {
  const descLower = description.toLowerCase();

  // Wide diagrams
  if (descLower.includes('timeline') || descLower.includes('gantt') ||
      descLower.includes('horizontal') || descLower.includes('wide')) {
    return '16:9';
  }

  // Tall diagrams
  if (descLower.includes('vertical') || descLower.includes('tall') ||
      descLower.includes('hierarchy') || descLower.includes('tree')) {
    return '3:4';
  }

  // Portrait for certain diagram types
  if (diagramType === 'flowchart' && descLower.includes('top to bottom')) {
    return '3:4';
  }

  // Default to square
  return '1:1';
}

/**
 * Suggests an appropriate diagram style based on context
 */
export function suggestDiagramStyle(description: string, subject?: string): DiagramStyle {
  const descLower = description.toLowerCase();
  const subjectLower = subject?.toLowerCase() || '';

  // Hand-drawn for informal contexts
  if (descLower.includes('sketch') || descLower.includes('informal') ||
      descLower.includes('brainstorm')) {
    return 'hand-drawn';
  }

  // Minimalist for simple concepts
  if (descLower.includes('simple') || descLower.includes('basic') ||
      descLower.includes('minimal')) {
    return 'minimalist';
  }

  // Detailed for complex scientific diagrams
  if (descLower.includes('detailed') || descLower.includes('complex') ||
      subjectLower.includes('biology') || subjectLower.includes('chemistry') ||
      subjectLower.includes('anatomy')) {
    return 'detailed';
  }

  // Default to technical for academic content
  return 'technical';
}

/**
 * Cleans and normalizes Mermaid code
 */
export function normalizeMermaidCode(mermaidCode: string): string {
  let cleaned = mermaidCode.trim();

  // Remove markdown code fences if present
  if (cleaned.startsWith('```mermaid')) {
    cleaned = cleaned.replace(/^```mermaid\n?/, '').replace(/\n?```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }

  return cleaned.trim();
}
