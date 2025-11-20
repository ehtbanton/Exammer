/**
 * @fileOverview Validates geometric diagrams against their constraints.
 *
 * Provides validation functions to ensure diagram commands satisfy their
 * declared geometric constraints. Useful for debugging extraction and
 * variant generation quality.
 */

import type { GeometricDiagram, GeometricConstraint } from './geometric-schema';

interface Point {
  x: number;
  y: number;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Parse a point coordinate from a command or point name.
 */
function parsePoint(ref: string, points: Record<string, Point>): Point | null {
  // Check if it's a Midpoint function
  const midpointMatch = ref.match(/^Midpoint\(([^,]+),([^)]+)\)$/);
  if (midpointMatch) {
    const p1 = parsePoint(midpointMatch[1].trim(), points);
    const p2 = parsePoint(midpointMatch[2].trim(), points);
    if (p1 && p2) {
      return {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2,
      };
    }
    return null;
  }

  // Check if it's a named point
  if (points[ref]) {
    return points[ref];
  }

  // Try to parse as coordinate
  if (ref.includes(',')) {
    const match = ref.trim().match(/^\(?(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)?$/);
    if (match) {
      return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
    }
  }

  return null;
}

/**
 * Extract points from diagram commands.
 */
function extractPoints(commands: string[]): Record<string, Point> {
  const points: Record<string, Point> = {};

  for (const command of commands) {
    const trimmed = command.trim();

    // Point definition: A=(100,50)
    const pointMatch = trimmed.match(/^([A-Z]\w*)=\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)$/);
    if (pointMatch) {
      const name = pointMatch[1];
      points[name] = { x: parseFloat(pointMatch[2]), y: parseFloat(pointMatch[3]) };
    }
  }

  return points;
}

/**
 * Parse line/segment reference and extract the two points.
 */
function parseLineSegment(ref: string, points: Record<string, Point>): [Point, Point] | null {
  const match = ref.match(/^(Line|Segment)\(([^,]+),([^)]+)\)$/);
  if (!match) return null;

  const p1 = parsePoint(match[2].trim(), points);
  const p2 = parsePoint(match[3].trim(), points);

  if (p1 && p2) {
    return [p1, p2];
  }

  return null;
}

/**
 * Calculate angle between two vectors (in degrees).
 */
function angleBetweenVectors(v1: Point, v2: Point): number {
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

  if (mag1 === 0 || mag2 === 0) return 0;

  const cosAngle = dot / (mag1 * mag2);
  // Clamp to [-1, 1] to handle floating point errors
  const clampedCos = Math.max(-1, Math.min(1, cosAngle));
  return (Math.acos(clampedCos) * 180) / Math.PI;
}

/**
 * Check if two lines are perpendicular (within tolerance).
 */
function arePerpendicular(line1: [Point, Point], line2: [Point, Point], tolerance = 2): boolean {
  const v1 = { x: line1[1].x - line1[0].x, y: line1[1].y - line1[0].y };
  const v2 = { x: line2[1].x - line2[0].x, y: line2[1].y - line2[0].y };

  const angle = angleBetweenVectors(v1, v2);
  return Math.abs(angle - 90) < tolerance;
}

/**
 * Check if two lines are parallel (within tolerance).
 */
function areParallel(line1: [Point, Point], line2: [Point, Point], tolerance = 2): boolean {
  const v1 = { x: line1[1].x - line1[0].x, y: line1[1].y - line1[0].y };
  const v2 = { x: line2[1].x - line2[0].x, y: line2[1].y - line2[0].y };

  const angle = angleBetweenVectors(v1, v2);
  return angle < tolerance || Math.abs(angle - 180) < tolerance;
}

/**
 * Calculate distance between two points.
 */
function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if two lengths are equal (within tolerance).
 */
function areEqualLengths(len1: number, len2: number, tolerance = 0.5): boolean {
  return Math.abs(len1 - len2) < tolerance;
}

/**
 * Validate a single constraint against the diagram.
 */
function validateConstraint(
  constraint: GeometricConstraint,
  points: Record<string, Point>
): { valid: boolean; message?: string } {
  try {
    switch (constraint.type) {
      case 'perpendicular': {
        if (constraint.entities.length !== 2) {
          return { valid: false, message: 'Perpendicular constraint requires exactly 2 entities' };
        }
        const line1 = parseLineSegment(constraint.entities[0], points);
        const line2 = parseLineSegment(constraint.entities[1], points);

        if (!line1 || !line2) {
          return { valid: false, message: `Could not parse lines: ${constraint.entities.join(', ')}` };
        }

        const isPerpendicular = arePerpendicular(line1, line2);
        if (!isPerpendicular) {
          const v1 = { x: line1[1].x - line1[0].x, y: line1[1].y - line1[0].y };
          const v2 = { x: line2[1].x - line2[0].x, y: line2[1].y - line2[0].y };
          const angle = angleBetweenVectors(v1, v2);
          return {
            valid: false,
            message: `Lines are not perpendicular (angle: ${angle.toFixed(1)}°, expected: 90°)`
          };
        }
        return { valid: true };
      }

      case 'parallel': {
        if (constraint.entities.length !== 2) {
          return { valid: false, message: 'Parallel constraint requires exactly 2 entities' };
        }
        const line1 = parseLineSegment(constraint.entities[0], points);
        const line2 = parseLineSegment(constraint.entities[1], points);

        if (!line1 || !line2) {
          return { valid: false, message: `Could not parse lines: ${constraint.entities.join(', ')}` };
        }

        const isParallel = areParallel(line1, line2);
        if (!isParallel) {
          const v1 = { x: line1[1].x - line1[0].x, y: line1[1].y - line1[0].y };
          const v2 = { x: line2[1].x - line2[0].x, y: line2[1].y - line2[0].y };
          const angle = angleBetweenVectors(v1, v2);
          return {
            valid: false,
            message: `Lines are not parallel (angle between: ${angle.toFixed(1)}°)`
          };
        }
        return { valid: true };
      }

      case 'equal-length': {
        if (constraint.entities.length !== 2) {
          return { valid: false, message: 'Equal-length constraint requires exactly 2 segments' };
        }
        const seg1 = parseLineSegment(constraint.entities[0], points);
        const seg2 = parseLineSegment(constraint.entities[1], points);

        if (!seg1 || !seg2) {
          return { valid: false, message: `Could not parse segments: ${constraint.entities.join(', ')}` };
        }

        const len1 = distance(seg1[0], seg1[1]);
        const len2 = distance(seg2[0], seg2[1]);

        const areEqual = areEqualLengths(len1, len2);
        if (!areEqual) {
          return {
            valid: false,
            message: `Segments are not equal length (${len1.toFixed(1)} vs ${len2.toFixed(1)})`
          };
        }
        return { valid: true };
      }

      case 'midpoint': {
        if (constraint.entities.length !== 3) {
          return { valid: false, message: 'Midpoint constraint requires 3 entities (midpoint, p1, p2)' };
        }
        const mid = parsePoint(constraint.entities[0], points);
        const p1 = parsePoint(constraint.entities[1], points);
        const p2 = parsePoint(constraint.entities[2], points);

        if (!mid || !p1 || !p2) {
          return { valid: false, message: 'Could not parse points for midpoint constraint' };
        }

        const expectedMid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const distFromExpected = distance(mid, expectedMid);

        if (distFromExpected > 1) {
          return {
            valid: false,
            message: `Point is not at midpoint (distance from expected: ${distFromExpected.toFixed(1)})`
          };
        }
        return { valid: true };
      }

      case 'collinear': {
        if (constraint.entities.length < 3) {
          return { valid: false, message: 'Collinear constraint requires at least 3 points' };
        }
        const pts = constraint.entities.map(e => parsePoint(e, points)).filter(p => p !== null) as Point[];

        if (pts.length < 3) {
          return { valid: false, message: 'Could not parse enough points for collinear constraint' };
        }

        // Check if all points lie on the same line
        // Use cross product: for points to be collinear, cross product should be ~0
        const p1 = pts[0];
        const p2 = pts[1];

        for (let i = 2; i < pts.length; i++) {
          const p3 = pts[i];
          const crossProduct = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
          if (Math.abs(crossProduct) > 1) {
            return {
              valid: false,
              message: `Points are not collinear (cross product: ${crossProduct.toFixed(1)})`
            };
          }
        }
        return { valid: true };
      }

      // For other constraint types, we can add more validation as needed
      default:
        return { valid: true, message: `Validation not implemented for constraint type: ${constraint.type}` };
    }
  } catch (error) {
    return { valid: false, message: `Error validating constraint: ${error}` };
  }
}

/**
 * Validate all constraints in a diagram.
 */
export function validateDiagram(diagram: GeometricDiagram): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // Extract points from commands
  const points = extractPoints(diagram.commands);

  if (Object.keys(points).length === 0) {
    result.warnings.push('No points found in diagram commands');
  }

  // Validate each constraint
  if (diagram.constraints && diagram.constraints.length > 0) {
    for (const constraint of diagram.constraints) {
      const validation = validateConstraint(constraint, points);

      if (!validation.valid) {
        result.valid = false;
        result.errors.push(
          `Constraint ${constraint.type} failed: ${validation.message || 'Unknown error'}`
        );
      }
    }
  } else {
    result.warnings.push('No constraints defined for this diagram');
  }

  // Validate semantic info references
  if (diagram.semanticInfo) {
    if (diagram.semanticInfo.rightAngleMarkers) {
      for (const pointName of diagram.semanticInfo.rightAngleMarkers) {
        if (!points[pointName]) {
          result.warnings.push(`Right angle marker references undefined point: ${pointName}`);
        }
      }
    }
  }

  return result;
}

/**
 * Get a human-readable validation report.
 */
export function getValidationReport(diagram: GeometricDiagram): string {
  const result = validateDiagram(diagram);

  let report = '=== Diagram Validation Report ===\n\n';

  if (result.valid && result.errors.length === 0) {
    report += '✓ All constraints validated successfully\n';
  } else {
    report += `✗ Validation failed with ${result.errors.length} error(s)\n\n`;

    if (result.errors.length > 0) {
      report += 'Errors:\n';
      result.errors.forEach((error, i) => {
        report += `  ${i + 1}. ${error}\n`;
      });
      report += '\n';
    }
  }

  if (result.warnings.length > 0) {
    report += 'Warnings:\n';
    result.warnings.forEach((warning, i) => {
      report += `  ${i + 1}. ${warning}\n`;
    });
    report += '\n';
  }

  return report;
}
