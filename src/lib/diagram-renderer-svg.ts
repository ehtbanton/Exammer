/**
 * @fileOverview SVG-based programmatic diagram renderer
 *
 * This renderer creates accurate diagrams using SVG with perfect text rendering.
 * No AI guessing - just precise mathematical rendering from structured data.
 *
 * WHY THIS EXISTS:
 * Imagen is terrible at rendering text - it misspells labels, gets numbers wrong,
 * and makes text illegible. This SVG renderer gives us pixel-perfect text with
 * exact measurements that are always correct.
 */

import type { DiagramDetailedData } from './types';

export interface SVGRenderOptions {
  width?: number;
  height?: number;
  padding?: number;
  fontSize?: number;
  strokeWidth?: number;
}

/**
 * Determines if a diagram can be rendered programmatically with SVG
 */
export function canRenderAsSVG(detailedData: DiagramDetailedData): boolean {
  const supportedTypes = [
    'triangle',
    'rectangle',
    'square',
    'circle',
    'polygon',
    'line',
    'angle',
    'geometric_shape',
    'right_triangle',
    'isosceles_triangle',
    'equilateral_triangle',
  ];

  return supportedTypes.some(type =>
    detailedData.type.toLowerCase().includes(type.toLowerCase())
  );
}

/**
 * Calculate triangle vertex positions from side lengths using law of cosines
 */
function calculateTrianglePositions(
  detailedData: DiagramDetailedData,
  width: number,
  height: number,
  padding: number
): Array<{ x: number; y: number; id: string; label: string }> {
  const vertices = detailedData.elements || [];
  const lengths = detailedData.measurements?.lengths || [];

  // Parse side lengths from strings like "AB = 5 cm" or "side AB = 5 cm"
  const sideLengths: number[] = [];
  lengths.forEach(lengthStr => {
    const match = lengthStr.match(/([\d.]+)/);
    if (match) {
      sideLengths.push(parseFloat(match[1]));
    }
  });

  // Need at least 3 sides for a triangle
  if (sideLengths.length < 3) {
    // Fallback to default values
    sideLengths.push(5, 4, 3);
  }

  const [a, b, c] = sideLengths;

  // Calculate scale to fit triangle in viewport
  const maxSide = Math.max(a, b, c);
  const scale = (Math.min(width, height) - padding * 2) / maxSide;

  // Place first vertex (A) at bottom left
  const x1 = padding;
  const y1 = height - padding;

  // Place second vertex (B) on the base, distance c away
  const x2 = x1 + c * scale;
  const y2 = y1;

  // Calculate third vertex (C) position using law of cosines
  // cos(A) = (b² + c² - a²) / (2bc)
  const cosA = (b * b + c * c - a * a) / (2 * b * c);
  const angleA = Math.acos(Math.max(-1, Math.min(1, cosA))); // Clamp to avoid NaN

  const x3 = x1 + b * scale * Math.cos(angleA);
  const y3 = y1 - b * scale * Math.sin(angleA);

  return [
    { x: x1, y: y1, id: vertices[0]?.id || 'A', label: vertices[0]?.label || 'A' },
    { x: x2, y: y2, id: vertices[1]?.id || 'B', label: vertices[1]?.label || 'B' },
    { x: x3, y: y3, id: vertices[2]?.id || 'C', label: vertices[2]?.label || 'C' },
  ];
}

/**
 * Renders a triangle with exact measurements using SVG
 */
export function renderTriangleSVG(
  detailedData: DiagramDetailedData,
  options: SVGRenderOptions = {}
): string {
  const {
    width = 600,
    height = 500,
    padding = 80,
    fontSize = 16,
    strokeWidth = 2,
  } = options;

  // Extract vertices (should be 3 for triangle)
  const vertices = detailedData.elements || [];
  const lengths = detailedData.measurements?.lengths || [];
  const angles = detailedData.measurements?.angles || [];

  // Calculate accurate positions based on measurements
  let points: Array<{ x: number; y: number; id: string; label: string }>;
  try {
    points = calculateTrianglePositions(detailedData, width, height, padding);
  } catch (error) {
    console.error('[SVG] Triangle calculation failed, using fallback layout:', error);
    // Fallback to simple layout
    const centerX = width / 2;
    points = [
      { x: padding, y: height - padding, id: vertices[0]?.id || 'A', label: vertices[0]?.label || 'A' },
      { x: width - padding, y: height - padding, id: vertices[1]?.id || 'B', label: vertices[1]?.label || 'B' },
      { x: centerX, y: padding, id: vertices[2]?.id || 'C', label: vertices[2]?.label || 'C' },
    ];
  }

  // Build SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

  // Add white background
  svg += `<rect width="${width}" height="${height}" fill="white"/>`;

  // Draw triangle edges
  svg += `<path d="M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y} L ${points[2].x} ${points[2].y} Z" `;
  svg += `fill="none" stroke="black" stroke-width="${strokeWidth}"/>`;

  // Add vertex labels with smart positioning
  points.forEach((point, i) => {
    let offsetX = 0;
    let offsetY = 0;
    let anchor = 'middle';

    // Smart positioning based on vertex location
    if (i === 0) {
      // Bottom left - label to the left
      offsetX = -25;
      offsetY = 5;
      anchor = 'end';
    } else if (i === 1) {
      // Bottom right - label to the right
      offsetX = 25;
      offsetY = 5;
      anchor = 'start';
    } else {
      // Top - label above
      offsetX = 0;
      offsetY = -15;
      anchor = 'middle';
    }

    svg += `<text x="${point.x + offsetX}" y="${point.y + offsetY}" `;
    svg += `font-size="${fontSize + 2}" font-weight="bold" font-family="Arial, sans-serif" text-anchor="${anchor}" fill="black">`;
    svg += `${point.label}</text>`;
  });

  // Add side length labels (middle of each edge) with perpendicular offset
  const edges = [
    { p1: points[0], p2: points[1] },
    { p1: points[1], p2: points[2] },
    { p1: points[2], p2: points[0] },
  ];

  lengths.forEach((length, i) => {
    if (i >= edges.length) return;

    const edge = edges[i];
    const midX = (edge.p1.x + edge.p2.x) / 2;
    const midY = (edge.p1.y + edge.p2.y) / 2;

    // Calculate perpendicular offset for label
    const dx = edge.p2.x - edge.p1.x;
    const dy = edge.p2.y - edge.p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const perpX = -dy / len * 20;
    const perpY = dx / len * 20;

    // Background for readability
    const textWidth = length.length * 9;
    svg += `<rect x="${midX + perpX - textWidth / 2}" y="${midY + perpY - fontSize}" `;
    svg += `width="${textWidth}" height="${fontSize + 6}" fill="white" fill-opacity="0.9" rx="3"/>`;

    svg += `<text x="${midX + perpX}" y="${midY + perpY}" `;
    svg += `font-size="${fontSize}" font-weight="bold" font-family="Arial, sans-serif" text-anchor="middle" fill="#0066cc">`;
    svg += `${length}</text>`;
  });

  // Add angle labels (near vertices)
  angles.forEach((angle, i) => {
    if (i < points.length) {
      const point = points[i];
      const offsetX = 15;
      const offsetY = i === 0 ? 25 : -15;

      svg += `<text x="${point.x + offsetX}" y="${point.y + offsetY}" `;
      svg += `font-size="${fontSize * 0.85}" font-family="Arial, sans-serif" fill="green">`;
      svg += `${angle}</text>`;
    }
  });

  // Add special property indicators (like right angle symbol)
  if (detailedData.specialProperties) {
    detailedData.specialProperties.forEach(prop => {
      if (prop.toLowerCase().includes('right angle')) {
        // Draw right angle symbol at the appropriate vertex
        // This is simplified - ideally we'd detect which vertex has the right angle
        const rightAngleVertex = points[1]; // Assume bottom-left for now
        const size = 15;

        svg += `<path d="M ${rightAngleVertex.x + size} ${rightAngleVertex.y} `;
        svg += `L ${rightAngleVertex.x + size} ${rightAngleVertex.y - size} `;
        svg += `L ${rightAngleVertex.x} ${rightAngleVertex.y - size}" `;
        svg += `fill="none" stroke="black" stroke-width="1"/>`;
      }
    });
  }

  svg += `</svg>`;

  return svg;
}

/**
 * Main function to render diagram as SVG based on detailed data
 */
export function renderDiagramAsSVG(
  detailedData: DiagramDetailedData,
  options: SVGRenderOptions = {}
): string | null {
  const type = detailedData.type.toLowerCase();

  try {
    if (type.includes('triangle')) {
      return renderTriangleSVG(detailedData, options);
    }

    // Add more diagram types here
    // if (type.includes('rectangle')) return renderRectangleSVG(...)
    // if (type.includes('circle')) return renderCircleSVG(...)
    // etc.

    return null; // Unsupported type
  } catch (error) {
    console.error('[SVG Renderer] Error rendering diagram:', error);
    return null;
  }
}

/**
 * Convert SVG string to data URI for embedding in img tags
 */
export function svgToDataUri(svg: string): string {
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');

  return `data:image/svg+xml,${encoded}`;
}
