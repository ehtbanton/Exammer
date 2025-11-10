/**
 * Diagram Rendering Configuration
 *
 * This file controls how diagrams are rendered throughout the application.
 *
 * IMPROVED DIAGRAM SYSTEM:
 * The system now extracts detailed structured data (measurements, angles, elements, connections)
 * during PDF processing. This ensures mathematical accuracy when regenerating diagrams.
 *
 * How it works:
 * 1. PDF Extraction: Gemini analyzes diagrams and extracts ALL exact measurements, labels, and values
 * 2. Structured Storage: Data is stored as JSON with precise values (e.g., "side AB = 5 cm", "angle = 60°")
 * 3. Accurate Generation: When regenerating, Imagen receives detailed prompts with all exact values
 *
 * This eliminates the previous issues where:
 * - Mermaid misinterpreted diagram types (e.g., triangle → graph)
 * - Imagen guessed values incorrectly (e.g., "5 cm" became "6 cm")
 */

export const DIAGRAM_CONFIG = {
  /**
   * Force Imagen-only mode
   *
   * When true: All diagrams will be rendered using Google Imagen 3 AI image generation
   *            Uses detailed structured data when available for maximum accuracy
   * When false: Diagrams will use Mermaid by default, with Imagen as fallback
   *
   * Recommendation: Keep true for math/science diagrams with precise measurements
   *                 Set to false for flowcharts, concept maps, and simple graphs
   *
   * Current: true (Imagen-only mode with detailed data support)
   */
  FORCE_IMAGEN: true,

  /**
   * Enable fallback to Imagen when Mermaid fails
   * Only applies when FORCE_IMAGEN is false
   *
   * When true: If Mermaid rendering fails, automatically try Imagen
   * When false: Show error message if Mermaid fails
   */
  ENABLE_FALLBACK: true,

  /**
   * Default diagram style for Imagen generation
   * Options: 'technical' | 'hand-drawn' | 'minimalist' | 'detailed'
   *
   * Note: When detailed data is available, the system automatically uses technical style
   *       to ensure measurements are clearly visible
   */
  DEFAULT_STYLE: 'technical' as const,

  /**
   * Default aspect ratio for Imagen generation
   * Options: '1:1' | '3:4' | '4:3' | '9:16' | '16:9'
   */
  DEFAULT_ASPECT_RATIO: '1:1' as const,
};
