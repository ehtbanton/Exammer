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
 *
 * Points can be referenced across commands, reducing duplication and improving clarity.
 */

export interface GeometricDiagram {
  width: number;  // Canvas width
  height: number; // Canvas height
  commands: string[]; // Array of command strings
}
