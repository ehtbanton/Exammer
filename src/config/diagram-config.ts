/**
 * Diagram Rendering Configuration
 *
 * This file controls how diagrams are rendered throughout the application.
 * Toggle these settings to switch between Mermaid and Imagen rendering.
 */

export const DIAGRAM_CONFIG = {
  /**
   * Force Imagen-only mode
   *
   * When true: All diagrams will be rendered using Google Imagen 3 AI image generation
   * When false: Diagrams will use Mermaid by default, with Imagen as fallback
   *
   * Current: true (Imagen-only mode)
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
   */
  DEFAULT_STYLE: 'technical' as const,

  /**
   * Default aspect ratio for Imagen generation
   * Options: '1:1' | '3:4' | '4:3' | '9:16' | '16:9'
   */
  DEFAULT_ASPECT_RATIO: '1:1' as const,
};
