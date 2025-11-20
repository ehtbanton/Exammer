"use client";

/**
 * @fileOverview SVG renderer for geometric command diagrams.
 *
 * Parses and renders geometric commands (e.g., "A=(0,0)", "Triangle(A,B,C)", "Circle(O,5)").
 * No interactivity - just clean, static rendering.
 */

import React from 'react';
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

  // Map to store defined points
  const points: Record<string, Point> = {};

  // Helper to get a point (either from map or parse coordinate)
  const getPoint = (ref: string): Point => {
    // Check if it's a Midpoint function
    const midpointMatch = ref.match(/^Midpoint\(([^,]+),([^)]+)\)$/);
    if (midpointMatch) {
      const p1 = getPoint(midpointMatch[1].trim());
      const p2 = getPoint(midpointMatch[2].trim());
      return {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2,
      };
    }

    // Check if it's a named point
    if (points[ref]) {
      return points[ref];
    }

    // Try to parse as coordinate
    if (ref.includes(',')) {
      return parseCoord(ref);
    }

    throw new Error(`Unknown point reference: ${ref}`);
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
      continue;
    }

    // Triangle: Triangle(A,B,C)
    const triangleMatch = trimmed.match(/^Triangle\(([^)]+)\)$/);
    if (triangleMatch) {
      const args = parseArgs(triangleMatch[1]);
      if (args.length === 3) {
        const points_arr = args.map(getPoint);
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
      continue;
    }

    // Rectangle: Rectangle(A,B,C,D)
    const rectangleMatch = trimmed.match(/^Rectangle\(([^)]+)\)$/);
    if (rectangleMatch) {
      const args = parseArgs(rectangleMatch[1]);
      if (args.length === 4) {
        const points_arr = args.map(getPoint);
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
      continue;
    }

    // Polygon: Polygon(A,B,C,D,...)
    const polygonMatch = trimmed.match(/^Polygon\(([^)]+)\)$/);
    if (polygonMatch) {
      const args = parseArgs(polygonMatch[1]);
      if (args.length >= 3) {
        const points_arr = args.map(getPoint);
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
      continue;
    }

    // Circle: Circle(O,50)
    const circleMatch = trimmed.match(/^Circle\(([^,]+),\s*(-?\d+(?:\.\d+)?)\)$/);
    if (circleMatch) {
      const center = getPoint(circleMatch[1].trim());
      const radius = parseFloat(circleMatch[2]);
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
      continue;
    }

    // Arc: Arc(O,50,0,90)
    const arcMatch = trimmed.match(/^Arc\(([^,]+),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)$/);
    if (arcMatch) {
      const center = getPoint(arcMatch[1].trim());
      const radius = parseFloat(arcMatch[2]);
      const startAngle = parseFloat(arcMatch[3]);
      const endAngle = parseFloat(arcMatch[4]);

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
      continue;
    }

    // Label: Label(A,"text") or Label(Midpoint(A,B),"text")
    const labelMatch = trimmed.match(/^Label\(([^,]+),"([^"]+)"\)$/);
    if (labelMatch) {
      const position = getPoint(labelMatch[1].trim());
      const text = labelMatch[2];
      elements.push(
        <text
          key={`label-${elementIndex++}`}
          x={position.x}
          y={position.y}
          fill="black"
          fontSize={14}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {text}
        </text>
      );
      continue;
    }
  }

  return (
    <svg
      viewBox={viewBox}
      className={className || 'w-full h-auto'}
      style={{ maxWidth: '100%', height: 'auto' }}
    >
      {elements}
    </svg>
  );
}
