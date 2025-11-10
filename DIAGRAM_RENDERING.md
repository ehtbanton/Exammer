# Diagram Rendering Configuration

This document explains how diagram rendering works in Exammer and how to configure it.

## Current Mode: **Imagen-Only** 🎨

The application is currently configured to use **Google Imagen 3 AI** for all diagram generation, bypassing Mermaid entirely.

## How It Works

### 1. **Mermaid Workflows (Preserved but Not Used)**
- Exam paper extraction still generates Mermaid syntax from diagrams
- Question variant generation still adapts Mermaid diagrams
- All validation and normalization is still performed
- **This data is stored but not rendered**

### 2. **Imagen Rendering (Active)**
- When a question with a diagram is displayed, the system:
  1. Detects that `FORCE_IMAGEN` is enabled
  2. Skips Mermaid rendering entirely
  3. Uses the question text as a description
  4. Generates an image using Google Imagen 3
  5. Displays the AI-generated diagram

## Configuration

### Quick Toggle

Edit `src/config/diagram-config.ts`:

```typescript
export const DIAGRAM_CONFIG = {
  // Set to false to re-enable Mermaid
  FORCE_IMAGEN: true,  // ← Change this to false

  ENABLE_FALLBACK: true,
  DEFAULT_STYLE: 'technical',
  DEFAULT_ASPECT_RATIO: '1:1',
};
```

### Available Modes

#### Mode 1: **Imagen-Only** (Current)
```typescript
FORCE_IMAGEN: true
```
- ✅ All diagrams use AI image generation
- ✅ High quality, realistic diagrams
- ❌ Higher API costs
- ❌ Slower generation time

#### Mode 2: **Mermaid with Fallback** (Recommended for Production)
```typescript
FORCE_IMAGEN: false
ENABLE_FALLBACK: true
```
- ✅ Fast, efficient Mermaid rendering by default
- ✅ Automatic fallback to Imagen if Mermaid fails
- ✅ Best of both worlds
- ✅ Lower API costs

#### Mode 3: **Mermaid-Only**
```typescript
FORCE_IMAGEN: false
ENABLE_FALLBACK: false
```
- ✅ Fastest rendering
- ✅ Lowest API costs
- ❌ Shows error if diagram syntax is invalid
- ❌ No complex diagrams

## Diagram Styles (Imagen Only)

When using Imagen, you can configure the visual style:

- **`technical`** (default): Clean, precise diagrams with sharp lines
- **`hand-drawn`**: Informal, whiteboard-style sketches
- **`minimalist`**: Simple, essential elements only
- **`detailed`**: Comprehensive scientific illustrations

## Aspect Ratios (Imagen Only)

- **`1:1`** (default): Square diagrams
- **`3:4`**: Vertical/portrait orientation
- **`4:3`**: Horizontal/landscape orientation
- **`16:9`**: Wide horizontal orientation
- **`9:16`**: Tall vertical orientation

## Files Modified for Imagen-Only Mode

1. **`src/config/diagram-config.ts`** - Central configuration
2. **`src/components/hybrid-diagram-renderer.tsx`** - Added `forceImagen` prop
3. **`src/app/subject/.../page.tsx`** - Uses config to control rendering

## Switching Back to Mermaid

To re-enable Mermaid rendering:

1. Open `src/config/diagram-config.ts`
2. Change `FORCE_IMAGEN: true` to `FORCE_IMAGEN: false`
3. Restart the dev server

That's it! The Mermaid workflows are still intact and will start working immediately.

## API Costs Comparison

**Mermaid Rendering:**
- Cost: $0 (client-side JavaScript)
- Speed: Instant

**Imagen 3 Generation:**
- Cost: ~$0.04 per image (Google Cloud pricing)
- Speed: 2-5 seconds per image

**Recommendation for Production:**
- Use Mode 2 (Mermaid with Fallback) to minimize costs
- Only complex diagrams that Mermaid can't render will use Imagen

## Troubleshooting

### Diagrams not appearing?
- Check that questions have `diagramMermaid` field populated
- Ensure Google Imagen 3 API is enabled and keys are configured
- Check browser console for error messages

### High API costs?
- Switch to Mode 2 (Mermaid with Fallback)
- Most diagrams will render with Mermaid (free)
- Only failing diagrams will use Imagen

### Want better quality diagrams?
- Adjust `DEFAULT_STYLE` to 'detailed'
- Improve the diagram descriptions in AI prompts
- Use larger aspect ratios for complex diagrams
