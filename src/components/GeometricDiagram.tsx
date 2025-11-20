"use client";

/**
 * @fileOverview SVG renderer for geometric command diagrams.
 *
 * Parses and renders geometric commands (e.g., "A=(0,0)", "Triangle(A,B,C)", "Circle(O,5)").
 * Supports LaTeX labels and semantic markers (right angles, tick marks, etc.).
 * No interactivity - just clean, static rendering.
 */

import React from 'react';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import type { GeometricDiagram } from '@/lib/geometric-schema';

interface GeometricDiagramProps {
  diagram: GeometricDiagram;
  className?: string;
}

interface Point {
  x: number;
  y: number;
}

// Parse a point coordinate like "(100,50)" or "100,50"
function parseCoord(coord: string): Point {
  const match = coord.trim().match(/^\(?(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)?$/);
  if (!match) {
    throw new Error(`Invalid coordinate: ${coord}`);
  }
  return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
}

// Parse function arguments like "A,B,C" or "O,50,0,90"
function parseArgs(argsStr: string): string[] {
  return argsStr.split(',').map(arg => arg.trim());
}

export function GeometricDiagram({ diagram, className }: GeometricDiagramProps) {
  // Check if diagram has the expected format
  if (!diagram || typeof diagram !== 'object') {
    console.error('[GeometricDiagram] Invalid diagram data:', diagram);
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800">
        Error: Invalid diagram data
      </div>
    );
  }

  // Check if this is old entity-based format (has 'groups' instead of 'commands')
  if ('groups' in diagram && !('commands' in diagram)) {
    console.error('[GeometricDiagram] Detected old entity-based format. Please re-extract this question.');
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-800">
        <p className="font-semibold mb-2">Diagram format outdated</p>
        <p className="text-sm">This question uses the old diagram format. Please re-extract this question to see the diagram.</p>
      </div>
    );
  }

  const { width, height, commands } = diagram;

  if (!commands || !Array.isArray(commands)) {
    console.error('[GeometricDiagram] Missing or invalid commands array:', diagram);
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800">
        Error: Missing commands in diagram data
      </div>
    );
  }

  const viewBox = `0 0 ${width} ${height}`;
  console.log(`[GeometricDiagram] Rendering diagram with ${commands.length} commands`);
  console.log(`[GeometricDiagram] Commands:`, commands);

  // Map to store defined points
  const points: Record<string, Point> = {};

  // Helper to get a point (either from map or parse coordinate)
  const getPoint = (ref: string): Point | null => {
    try {
      // Check if it's a Midpoint function
      const midpointMatch = ref.match(/^Midpoint\(([^,]+),([^)]+)\)$/);
      if (midpointMatch) {
        const p1 = getPoint(midpointMatch[1].trim());
        const p2 = getPoint(midpointMatch[2].trim());
        if (p1 && p2) {
          return {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2,
          };
        }
        console.warn(`[GeometricDiagram] Could not resolve midpoint for ${ref}`);
        return null;
      }

      // Check if it's a named point
      if (points[ref]) {
        return points[ref];
      }

      // Try to parse as coordinate
      if (ref.includes(',')) {
        return parseCoord(ref);
      }

      console.warn(`[GeometricDiagram] Unknown point reference: ${ref}`);
      return null;
    } catch (error) {
      console.warn(`[GeometricDiagram] Error resolving point ${ref}:`, error);
      return null;
    }
  };

  // Parse commands and render elements
  const elements: JSX.Element[] = [];
  let elementIndex = 0;

  for (const command of commands) {
    const trimmed = command.trim();

    // Point definition: A=(100,50)
    const pointMatch = trimmed.match(/^([A-Z]\w*)=\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)$/);
    if (pointMatch) {
      const name = pointMatch[1];
      points[name] = { x: parseFloat(pointMatch[2]), y: parseFloat(pointMatch[3]) };
      continue;
    }

    // Line: Line(A,B) or Segment(A,B)
    const lineMatch = trimmed.match(/^(Line|Segment)\(([^)]+)\)$/);
    if (lineMatch) {
      const args = parseArgs(lineMatch[2]);
      if (args.length === 2) {
        const p1 = getPoint(args[0]);
        const p2 = getPoint(args[1]);
        if (p1 && p2) {
          elements.push(
            <line
              key={`line-${elementIndex++}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="black"
              strokeWidth={2}
            />
          );
        }
      }
      continue;
    }

    // Triangle: Triangle(A,B,C)
    const triangleMatch = trimmed.match(/^Triangle\(([^)]+)\)$/);
    if (triangleMatch) {
      const args = parseArgs(triangleMatch[1]);
      if (args.length === 3) {
        const points_arr = args.map(getPoint).filter((p): p is Point => p !== null);
        if (points_arr.length === 3) {
          const pathData = `M ${points_arr[0].x} ${points_arr[0].y} L ${points_arr[1].x} ${points_arr[1].y} L ${points_arr[2].x} ${points_arr[2].y} Z`;
          elements.push(
            <path
              key={`triangle-${elementIndex++}`}
              d={pathData}
              fill="none"
              stroke="black"
              strokeWidth={2}
            />
          );
        }
      }
      continue;
    }

    // Rectangle: Rectangle(A,B,C,D)
    const rectangleMatch = trimmed.match(/^Rectangle\(([^)]+)\)$/);
    if (rectangleMatch) {
      const args = parseArgs(rectangleMatch[1]);
      if (args.length === 4) {
        const points_arr = args.map(getPoint).filter((p): p is Point => p !== null);
        if (points_arr.length === 4) {
          const pathData = `M ${points_arr[0].x} ${points_arr[0].y} L ${points_arr[1].x} ${points_arr[1].y} L ${points_arr[2].x} ${points_arr[2].y} L ${points_arr[3].x} ${points_arr[3].y} Z`;
          elements.push(
            <path
              key={`rectangle-${elementIndex++}`}
              d={pathData}
              fill="none"
              stroke="black"
              strokeWidth={2}
            />
          );
        }
      }
      continue;
    }

    // Polygon: Polygon(A,B,C,D,...)
    const polygonMatch = trimmed.match(/^Polygon\(([^)]+)\)$/);
    if (polygonMatch) {
      const args = parseArgs(polygonMatch[1]);
      if (args.length >= 3) {
        const points_arr = args.map(getPoint).filter((p): p is Point => p !== null);
        if (points_arr.length >= 3) {
          const pathData = 'M ' + points_arr.map(p => `${p.x} ${p.y}`).join(' L ') + ' Z';
          elements.push(
            <path
              key={`polygon-${elementIndex++}`}
              d={pathData}
              fill="none"
              stroke="black"
              strokeWidth={2}
            />
          );
        }
      }
      continue;
    }

    // Circle: Circle(O,50)
    const circleMatch = trimmed.match(/^Circle\(([^,]+),\s*(-?\d+(?:\.\d+)?)\)$/);
    if (circleMatch) {
      const center = getPoint(circleMatch[1].trim());
      const radius = parseFloat(circleMatch[2]);
      if (center) {
        elements.push(
          <circle
            key={`circle-${elementIndex++}`}
            cx={center.x}
            cy={center.y}
            r={radius}
            fill="none"
            stroke="black"
            strokeWidth={2}
          />
        );
      }
      continue;
    }

    // Arc: Arc(O,50,0,90)
    const arcMatch = trimmed.match(/^Arc\(([^,]+),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)$/);
    if (arcMatch) {
      const center = getPoint(arcMatch[1].trim());
      const radius = parseFloat(arcMatch[2]);
      const startAngle = parseFloat(arcMatch[3]);
      const endAngle = parseFloat(arcMatch[4]);

      if (center) {
        // Convert angles to radians (0° = right, counterclockwise)
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;

        // Calculate start and end points
        const startX = center.x + radius * Math.cos(startRad);
        const startY = center.y - radius * Math.sin(startRad); // Subtract because SVG Y increases downward
        const endX = center.x + radius * Math.cos(endRad);
        const endY = center.y - radius * Math.sin(endRad);

        // Determine if we need the large arc flag
        const angleDiff = ((endAngle - startAngle + 360) % 360);
        const largeArcFlag = angleDiff > 180 ? 1 : 0;

        const pathData = `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${endX} ${endY}`;

        elements.push(
          <path
            key={`arc-${elementIndex++}`}
            d={pathData}
            fill="none"
            stroke="black"
            strokeWidth={2}
          />
        );
      }
      continue;
    }

    // Meta-commands (e.g., Diagram_Note="text")
    // These don't render but provide information
    const metaMatch = trimmed.match(/^(\w+)="([^"]+)"$/);
    if (metaMatch) {
      console.log(`[GeometricDiagram] Meta: ${metaMatch[1]} = ${metaMatch[2]}`);
      continue;
    }

    // Label: Label(A,"text") or Label(Midpoint(A,B), "text")
    // Handle nested functions and optional spaces after comma
    const labelMatch = trimmed.match(/^Label\((.+?),\s*"([^"]+)"\)$/);
    if (labelMatch) {
      const positionRef = labelMatch[1].trim();
      const text = labelMatch[2];
      const position = getPoint(positionRef);

      if (!position) {
        console.warn(`[GeometricDiagram] Could not resolve position for label: ${trimmed}`);
        continue;
      }

      // Calculate smart offset for label positioning
      // For Midpoint labels, offset perpendicular to the line
      // For point labels, offset diagonally away
      let offsetX = 0;
      let offsetY = -20; // Default: above the point

      const midpointMatch = positionRef.match(/^Midpoint\(([^,]+),\s*([^)]+)\)$/);
      if (midpointMatch) {
        // This is a line measurement - position perpendicular to line
        const p1 = getPoint(midpointMatch[1].trim());
        const p2 = getPoint(midpointMatch[2].trim());
        if (p1 && p2) {
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            // Perpendicular vector (rotated 90°)
            const perpX = -dy / len;
            const perpY = dx / len;
            offsetX = perpX * 15;
            offsetY = perpY * 15;
          }
        }
      } else if (text.length <= 2 && /^[A-Z]$/.test(text)) {
        // Single letter point label - offset diagonally
        // Use the point's position to decide direction
        if (position.x < width / 3) {
          offsetX = -15; // Left side - offset left
        } else if (position.x > (2 * width) / 3) {
          offsetX = 15; // Right side - offset right
        }
        if (position.y < height / 3) {
          offsetY = -15; // Top - offset up
        } else if (position.y > (2 * height) / 3) {
          offsetY = 15; // Bottom - offset down
        }
      }

      const labelX = position.x + offsetX;
      const labelY = position.y + offsetY;

      // Check if text contains LaTeX (wrapped in $...$)
      const hasLatex = text.includes('$');

      if (hasLatex) {
        // For LaTeX labels, use foreignObject with better sizing
        const parts = text.split(/(\$[^$]+\$)/g);
        elements.push(
          <foreignObject
            key={`label-${elementIndex++}`}
            x={labelX - 60}
            y={labelY - 15}
            width={120}
            height={30}
            style={{ overflow: 'visible', pointerEvents: 'none' }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: '16px',
              textAlign: 'center',
              width: '100%',
              height: '100%',
              fontFamily: 'Arial, sans-serif'
            }}>
              {parts.map((part, i) => {
                if (part.startsWith('$') && part.endsWith('$')) {
                  const latex = part.slice(1, -1);
                  return <InlineMath key={i} math={latex} />;
                } else if (part) {
                  return <span key={i}>{part}</span>;
                }
                return null;
              })}
            </div>
          </foreignObject>
        );
      } else {
        // Plain text label with background for readability
        const textKey = `label-text-${elementIndex}`;
        const bgKey = `label-bg-${elementIndex}`;
        elementIndex++;

        // Estimate text width (rough approximation)
        const textWidth = text.length * 8;

        elements.push(
          <g key={textKey}>
            <rect
              key={bgKey}
              x={labelX - textWidth / 2 - 3}
              y={labelY - 10}
              width={textWidth + 6}
              height={20}
              fill="white"
              fillOpacity={0.8}
              stroke="none"
            />
            <text
              x={labelX}
              y={labelY}
              fill="black"
              fontSize={16}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="Arial, sans-serif"
            >
              {text}
            </text>
          </g>
        );
      }
      continue;
    }

    // Log unmatched commands for debugging
    console.warn(`[GeometricDiagram] Unmatched command: ${trimmed}`);
  }

  // Render semantic markers after all commands are parsed
  const semanticMarkers: JSX.Element[] = [];

  if (diagram.semanticInfo) {
    // Right angle markers (small squares at vertices)
    if (diagram.semanticInfo.rightAngleMarkers) {
      for (const pointName of diagram.semanticInfo.rightAngleMarkers) {
        if (points[pointName]) {
          const p = points[pointName];
          const size = 12; // Size of right angle square
          semanticMarkers.push(
            <rect
              key={`right-angle-${pointName}`}
              x={p.x - size/2}
              y={p.y - size/2}
              width={size}
              height={size}
              fill="none"
              stroke="black"
              strokeWidth={1.5}
            />
          );
        }
      }
    }

    // Equal segment markers (tick marks)
    if (diagram.semanticInfo.equalSegmentGroups) {
      for (const group of diagram.semanticInfo.equalSegmentGroups) {
        for (const segmentRef of group.segments) {
          // Parse segment reference like "Segment(A,B)"
          const segMatch = segmentRef.match(/^Segment\(([^,]+),([^)]+)\)$/);
          if (segMatch) {
            const p1 = getPoint(segMatch[1].trim());
            const p2 = getPoint(segMatch[2].trim());
            const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

            // Calculate perpendicular direction
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const perpX = -dy / len;
            const perpY = dx / len;

            // Draw tick marks
            const tickLength = 8;
            const tickSpacing = 4;
            for (let i = 0; i < group.marks; i++) {
              const offset = (i - (group.marks - 1) / 2) * tickSpacing;
              const baseX = mid.x + offset * dx / len;
              const baseY = mid.y + offset * dy / len;

              semanticMarkers.push(
                <line
                  key={`tick-${segmentRef}-${i}`}
                  x1={baseX - perpX * tickLength}
                  y1={baseY - perpY * tickLength}
                  x2={baseX + perpX * tickLength}
                  y2={baseY + perpY * tickLength}
                  stroke="black"
                  strokeWidth={1.5}
                />
              );
            }
          }
        }
      }
    }

    // Equal angle markers (arcs at vertices)
    if (diagram.semanticInfo.equalAngleGroups) {
      for (const group of diagram.semanticInfo.equalAngleGroups) {
        for (const vertex of group.angles) {
          if (points[vertex]) {
            const p = points[vertex];
            const arcRadius = 15;

            // Draw arc marks
            for (let i = 0; i < group.marks; i++) {
              const r = arcRadius + i * 4;
              semanticMarkers.push(
                <circle
                  key={`angle-arc-${vertex}-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill="none"
                  stroke="black"
                  strokeWidth={1}
                  opacity={0.6}
                />
              );
            }
          }
        }
      }
    }

    // Parallel line markers (arrows)
    if (diagram.semanticInfo.parallelGroups) {
      for (const group of diagram.semanticInfo.parallelGroups) {
        for (const lineRef of group.lines) {
          // Parse line reference like "Line(A,B)"
          const lineMatch = lineRef.match(/^(Line|Segment)\(([^,]+),([^)]+)\)$/);
          if (lineMatch) {
            const p1 = getPoint(lineMatch[2].trim());
            const p2 = getPoint(lineMatch[3].trim());
            const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

            // Calculate direction
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const dirX = dx / len;
            const dirY = dy / len;

            // Draw arrow marks
            const arrowSize = 6;
            const arrowSpacing = 8;
            for (let i = 0; i < group.marks; i++) {
              const offset = (i - (group.marks - 1) / 2) * arrowSpacing;
              const baseX = mid.x + offset * dirX;
              const baseY = mid.y + offset * dirY;

              semanticMarkers.push(
                <path
                  key={`arrow-${lineRef}-${i}`}
                  d={`M ${baseX - dirX * arrowSize} ${baseY - dirY * arrowSize}
                      L ${baseX} ${baseY}
                      L ${baseX - dirY * arrowSize} ${baseY + dirX * arrowSize}`}
                  fill="none"
                  stroke="black"
                  strokeWidth={1.5}
                />
              );
            }
          }
        }
      }
    }
  }

  return (
    <svg
      viewBox={viewBox}
      className={className || 'w-full h-auto'}
      style={{ maxWidth: '100%', height: 'auto' }}
    >
      {elements}
      {semanticMarkers}
    </svg>
  );
}
