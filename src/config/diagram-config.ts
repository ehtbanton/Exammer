/**
 * Diagram Rendering Configuration
 *
 * This file controls how diagrams are rendered throughout the application.
 *
 * TIERED RENDERING SYSTEM:
 * The system uses a tiered approach to ensure accurate diagram rendering.
 *
 * Tier 1: Original PDF Images (100% accurate) - Not yet implemented
 * Tier 2: SVG Programmatic Rendering (Perfect text, exact measurements)
 *   - For geometric shapes: triangles, rectangles, circles, etc.
 *   - Text is rendered by browser - always crisp and legible
 *   - Measurements are guaranteed accurate
 *   - SOLVES IMAGEN'S TEXT PROBLEM
 *
 * Tier 3: Mermaid (Good for flowcharts/graphs)
 *   - Best for flowcharts, concept maps, network diagrams
 *
 * Tier 4: Imagen AI Generation (Last resort - poor text rendering)
 *   - WARNING: Imagen is terrible at rendering text
 *   - It misspells labels and gets numbers wrong
 *   - Only used when other methods aren't suitable
 *
 * How it works:
 * 1. PDF Extraction: Gemini extracts ALL exact measurements and structure
 * 2. Storage: Data stored as JSON with precise values
 * 3. Rendering: System tries SVG first, then falls back to Mermaid or Imagen
 */

export const DIAGRAM_CONFIG = {
  /**
   * Force Imagen mode
   *
   * When true: Skips SVG and Mermaid, goes straight to Imagen generation
   * When false: Uses tiered system (Original → SVG → Mermaid → Imagen)
   *
   * Tiered system priority:
   *   1. Original image from PDF (if available) - 100% accurate
   *   2. SVG programmatic rendering (for triangles, geometric shapes) - Perfect text
   *   3. Mermaid (for flowcharts) - Good for process diagrams
   *   4. Imagen (auto-generates when nothing else works) - Last resort
   *
   * Recommendation: FALSE for best quality (enables all tiers)
   *
   * Current: false (Tiered system - will auto-generate Imagen when needed)
   */
  FORCE_IMAGEN: false,

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
