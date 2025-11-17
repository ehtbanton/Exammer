/**
 * @fileOverview Custom geometric schema for representing diagrams as simple primitives.
 *
 * This schema allows any diagram to be represented using:
 * - Lines (straight segments between two points)
 * - Arcs (curved segments defined by center, radius, start/end angles)
 * - Text (positioned labels and annotations)
 *
 * Entities are organized into labeled groups for semantic understanding and modification.
 */

export interface Point {
  x: number;
  y: number;
}

export interface LineEntity {
  type: 'line';
  from: Point;
  to: Point;
  style?: {
    color?: string;
    width?: number;
    dashed?: boolean;
  };
}

export interface ArcEntity {
  type: 'arc';
  center: Point;
  radius: number;
  startAngle: number; // degrees, 0 = right, counterclockwise
  endAngle: number;   // degrees
  style?: {
    color?: string;
    width?: number;
    dashed?: boolean;
  };
}

export interface TextEntity {
  type: 'text';
  position: Point;
  content: string; // Plain text only
  style?: {
    color?: string;
    size?: number;
    align?: 'left' | 'center' | 'right';
  };
}

export type GeometricEntity = LineEntity | ArcEntity | TextEntity;

export interface EntityGroup {
  label: string; // Detailed description, e.g., "right triangle ABC with labeled vertices"
  entities: GeometricEntity[];
}

export interface GeometricDiagram {
  width: number;  // Canvas width
  height: number; // Canvas height
  groups: EntityGroup[];
}
