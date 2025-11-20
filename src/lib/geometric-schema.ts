/**
 * @fileOverview Geometric Commands schema for representing diagrams.
 *
 * This schema represents diagrams as a sequence of declarative commands,
 * similar to GeoGebra but simplified. Commands are string-based for conciseness
 * and AI-friendliness.
 *
 * Command Types:
 * - Points: A=(0,0), B=(3,4)
 * - Lines: Line(A,B), Segment(A,B)
 * - Shapes: Triangle(A,B,C), Rectangle(A,B,C,D), Polygon(A,B,C,...)
 * - Circles: Circle(O,5) [center point, radius]
 * - Arcs: Arc(O,5,0,90) [center, radius, start degrees, end degrees]
 * - Labels: Label(A,"text"), Label(Midpoint(A,B),"5cm")
 *   - Labels support LaTeX: Label(A,"$\\theta$"), Label(B,"$\\frac{1}{2}$")
 *
 * Points can be referenced across commands, reducing duplication and improving clarity.
 *
 * Constraints capture geometric relationships that must be preserved during variation.
 * Semantic info captures visual markers and annotations.
 */

/**
 * Represents a geometric constraint between diagram elements.
 * Constraints define relationships that must be preserved when generating variants.
 */
export interface GeometricConstraint {
  /** Type of geometric constraint */
  type:
    | 'perpendicular'    // Two lines/segments at 90°
    | 'parallel'         // Two lines/segments with same direction
    | 'equal-length'     // Two segments with same length
    | 'equal-angle'      // Two angles with same measure
    | 'collinear'        // Three or more points on same line
    | 'concentric'       // Circles sharing same center
    | 'inscribed'        // Shape inscribed in another
    | 'circumscribed'    // Shape circumscribed around another
    | 'tangent'          // Line/circle touching at exactly one point
    | 'midpoint'         // Point is midpoint of segment
    | 'angle-bisector'   // Line bisects an angle
    | 'congruent';       // Shapes are congruent

  /** Entities involved in this constraint (point names, line refs, etc.) */
  entities: string[];

  /** Optional metadata (e.g., {angle: 90}, {ratio: 0.5}) */
  metadata?: Record<string, number | string | boolean>;

  /** Human-readable description for debugging */
  description?: string;
}

/**
 * Semantic information about diagram annotations and markers.
 * This captures visual markers that indicate properties to students.
 */
export interface DiagramSemanticInfo {
  /** Right angle markers (small squares at vertices) */
  rightAngleMarkers?: string[];  // Point names where right angle squares should appear

  /** Equal segment markers (tick marks on segments) */
  equalSegmentGroups?: {
    /** Segments with same number of tick marks are equal length */
    segments: string[];  // e.g., ["Segment(A,B)", "Segment(C,D)"]
    marks: number;       // Number of tick marks (1, 2, 3, etc.)
  }[];

  /** Equal angle markers (arcs at vertices) */
  equalAngleGroups?: {
    /** Angles with same number of arc marks are equal */
    angles: string[];    // e.g., ["A", "B"] - vertex points
    marks: number;       // Number of arc marks
  }[];

  /** Parallel line markers (arrows on lines) */
  parallelGroups?: {
    /** Lines with same arrow marks are parallel */
    lines: string[];     // e.g., ["Line(A,B)", "Line(C,D)"]
    marks: number;       // Number of arrows
  }[];

  /** Marked angles (degree measurements or variable labels) */
  markedAngles?: {
    vertex: string;      // Point name
    label: string;       // e.g., "90°", "$\\theta$", "x"
    arms?: [string, string]; // Optional: points defining the angle arms
  }[];
}

/**
 * Semantic metadata about a diagram's geometric meaning.
 * Uses natural language to describe relationships and constraints.
 */
export interface DiagramMetadata {
  /** High-level description of the diagram */
  description?: string;

  /** Geometric relationships that are visible/important */
  relationships?: string[];

  /** Elements that can be changed in variants */
  variableElements?: string[];

  /** Constraints that must be preserved in variants */
  constraints?: string[];
}

/**
 * Main diagram structure with optional metadata.
 */
export interface GeometricDiagram {
  width: number;  // Canvas width in coordinate units
  height: number; // Canvas height in coordinate units
  commands: string[]; // Array of command strings

  /**
   * Semantic metadata describing geometric relationships.
   * Natural language descriptions that guide variant generation.
   */
  metadata?: DiagramMetadata;

  /**
   * Geometric constraints that must be preserved during variation.
   * These define the "shape family" - what properties define this type of diagram.
   */
  constraints?: GeometricConstraint[];

  /**
   * Visual semantic markers (right angles, tick marks, etc.).
   * These enhance the diagram's educational clarity.
   */
  semanticInfo?: DiagramSemanticInfo;

  /**
   * Confidence score from extraction (0-1).
   * Lower scores may need teacher review.
   */
  extractionConfidence?: number;
}
