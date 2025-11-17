"use client";

/**
 * @fileOverview Simple SVG renderer for geometric diagrams.
 *
 * Renders diagrams using lines, arcs, and text primitives from our custom schema.
 * No interactivity or complex features - just clean, static rendering.
 */

import React from 'react';
import type { GeometricDiagram, GeometricEntity, LineEntity, ArcEntity, TextEntity } from '@/lib/geometric-schema';

interface GeometricDiagramProps {
  diagram: GeometricDiagram;
  className?: string;
}

export function GeometricDiagram({ diagram, className }: GeometricDiagramProps) {
  const { width, height, groups } = diagram;

  // Default SVG dimensions (can be overridden via className)
  const viewBox = `0 0 ${width} ${height}`;

  const renderEntity = (entity: GeometricEntity, index: number): JSX.Element => {
    switch (entity.type) {
      case 'line': {
        const line = entity as LineEntity;
        return (
          <line
            key={`line-${index}`}
            x1={line.from.x}
            y1={line.from.y}
            x2={line.to.x}
            y2={line.to.y}
            stroke={line.style?.color || 'black'}
            strokeWidth={line.style?.width || 2}
            strokeDasharray={line.style?.dashed ? '5,5' : undefined}
          />
        );
      }

      case 'arc': {
        const arc = entity as ArcEntity;
        // Convert angles to radians
        const startRad = (arc.startAngle * Math.PI) / 180;
        const endRad = (arc.endAngle * Math.PI) / 180;

        // Calculate start and end points
        const startX = arc.center.x + arc.radius * Math.cos(startRad);
        const startY = arc.center.y + arc.radius * Math.sin(startRad);
        const endX = arc.center.x + arc.radius * Math.cos(endRad);
        const endY = arc.center.y + arc.radius * Math.sin(endRad);

        // Determine if we need the large arc flag
        const angleDiff = ((arc.endAngle - arc.startAngle + 360) % 360);
        const largeArcFlag = angleDiff > 180 ? 1 : 0;

        const pathData = `M ${startX} ${startY} A ${arc.radius} ${arc.radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;

        return (
          <path
            key={`arc-${index}`}
            d={pathData}
            fill="none"
            stroke={arc.style?.color || 'black'}
            strokeWidth={arc.style?.width || 2}
            strokeDasharray={arc.style?.dashed ? '5,5' : undefined}
          />
        );
      }

      case 'text': {
        const text = entity as TextEntity;
        return (
          <text
            key={`text-${index}`}
            x={text.position.x}
            y={text.position.y}
            fill={text.style?.color || 'black'}
            fontSize={text.style?.size || 14}
            textAnchor={text.style?.align || 'center'}
            dominantBaseline="middle"
          >
            {text.content}
          </text>
        );
      }

      default:
        return <></>;
    }
  };

  return (
    <svg
      viewBox={viewBox}
      className={className || 'w-full h-auto'}
      style={{ maxWidth: '100%', height: 'auto' }}
    >
      {groups.map((group, groupIndex) =>
        group.entities.map((entity, entityIndex) =>
          renderEntity(entity, groupIndex * 1000 + entityIndex)
        )
      )}
    </svg>
  );
}
