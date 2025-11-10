# Tiered Diagram Rendering System

## The Problem: Imagen's Text Rendering is Terrible

**Critical Issue:** Google Imagen AI is fundamentally bad at rendering text. It:
- ❌ Misspells labels ("Point A" becomes "Poinr A")
- ❌ Gets numbers wrong ("5 cm" becomes "6 cm" or "S cm")
- ❌ Makes text illegible (blurry, distorted characters)
- ❌ Inconsistent fonts and sizing
- ❌ Cannot handle mathematical symbols accurately

This is a dealbreaker for educational diagrams where precision is critical.

## The Solution: Tiered Rendering System

We implement a 4-tier fallback system that prioritizes accurate text rendering:

```
┌─────────────────────────────────────────────────────────────┐
│ Tier 1: Original PDF Images (100% accurate)                 │
│ ├─ Extract actual diagram images from PDF                   │
│ ├─ Display originals with zero loss                         │
│ └─ Status: Not yet implemented                              │
└─────────────────────────────────────────────────────────────┘
                    │ (if no original image)
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Tier 2: SVG Programmatic Rendering ⭐ PRIMARY METHOD        │
│ ├─ For: Triangles, rectangles, circles, geometric shapes    │
│ ├─ Uses: Structured data → mathematical calculation → SVG   │
│ ├─ Text: Rendered by browser (always crisp & legible)       │
│ ├─ Measurements: Guaranteed exact (no AI guessing)          │
│ └─ Result: PERFECT TEXT + EXACT VALUES                      │
└─────────────────────────────────────────────────────────────┘
                    │ (if not geometric shape)
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Tier 3: Mermaid Rendering                                   │
│ ├─ For: Flowcharts, graphs, network diagrams                │
│ ├─ Good: Process flows, concept maps, org charts            │
│ └─ Bad: Geometric shapes with measurements                  │
└─────────────────────────────────────────────────────────────┘
                    │ (if Mermaid fails or unsuitable)
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Tier 4: Imagen AI Generation ⚠️ LAST RESORT                 │
│ ├─ WARNING: Poor text rendering                             │
│ ├─ Use only for: Complex diagrams, photos, illustrations    │
│ └─ Avoid for: Anything with text or measurements            │
└─────────────────────────────────────────────────────────────┘
```

## How It Works

### Step 1: Extraction
During PDF processing, Gemini extracts detailed structured data:

```typescript
{
  type: "triangle",
  measurements: {
    lengths: ["AB = 5 cm", "BC = 3 cm", "AC = 4 cm"],
    angles: ["∠ABC = 90°", "∠BAC = 53.13°"]
  },
  elements: [
    { id: "A", label: "Point A" },
    { id: "B", label: "Point B" },
    { id: "C", label: "Point C" }
  ],
  specialProperties: ["right angle at B"]
}
```

### Step 2: Rendering Decision
`HybridDiagramRenderer` checks each tier in order:

```typescript
// 1. Check if SVG rendering is possible
if (detailedData && canRenderAsSVG(detailedData)) {
  // ✅ Use SVG - perfect text rendering
  const svg = renderDiagramAsSVG(detailedData);
}

// 2. Try Mermaid if we have Mermaid code
else if (mermaidCode && !forceImagen) {
  // ✅ Use Mermaid - good for flowcharts
  mermaid.render(mermaidCode);
}

// 3. Fall back to Imagen
else {
  // ⚠️ Use Imagen - last resort, poor text
  generateDiagramImage({ description, detailedData });
}
```

### Step 3: SVG Generation
For supported diagram types, we calculate exact positions:

```typescript
// Parse measurements
const sideA = 5; // from "AB = 5 cm"
const sideB = 3; // from "BC = 3 cm"
const sideC = 4; // from "AC = 4 cm"

// Calculate vertex positions using law of cosines
const angle = Math.acos((b² + c² - a²) / (2bc));
const x3 = x1 + b * Math.cos(angle);
const y3 = y1 - b * Math.sin(angle);

// Render as SVG with browser-rendered text
<svg>
  <path d="M {x1} {y1} L {x2} {y2} L {x3} {y3} Z" />
  <text x="{x1}" y="{y1}">Point A</text>
  <text x="{midX}" y="{midY}">5 cm</text> <!-- PERFECT TEXT -->
</svg>
```

## Supported Diagram Types (SVG)

Currently implemented:
- ✅ Triangles (all types: right, isosceles, equilateral, scalene)

Coming soon:
- 🔄 Rectangles
- 🔄 Circles
- 🔄 Polygons
- 🔄 Coordinate graphs
- 🔄 Bar charts

For unsupported types, system falls back to Mermaid or Imagen.

## Configuration

**File:** `src/config/diagram-config.ts`

```typescript
export const DIAGRAM_CONFIG = {
  // Set to false to enable tiered system
  FORCE_IMAGEN: false, // ⭐ RECOMMENDED

  // Enable automatic fallback
  ENABLE_FALLBACK: true,

  // Styles for Imagen (when used)
  DEFAULT_STYLE: 'technical',
  DEFAULT_ASPECT_RATIO: '1:1',
};
```

## Files Changed

### Core Rendering
- `src/lib/diagram-renderer-svg.ts` - NEW: SVG programmatic renderer
  - `renderTriangleSVG()` - Renders triangles with exact measurements
  - `calculateTrianglePositions()` - Uses law of cosines for accuracy
  - `canRenderAsSVG()` - Determines if diagram type is supported

- `src/components/hybrid-diagram-renderer.tsx` - UPDATED: Tiered rendering logic
  - Added SVG rendering as Tier 2
  - Prioritizes SVG over Mermaid and Imagen
  - Falls back gracefully when SVG not applicable

### Configuration
- `src/config/diagram-config.ts` - UPDATED: Changed default to `FORCE_IMAGEN: false`
  - Enables tiered system by default
  - Documents the 4-tier approach

### Existing (Unchanged)
- `src/ai/flows/extract-paper-questions.ts` - Extracts detailed data
- `src/lib/diagram-generation.ts` - Builds Imagen prompts
- `src/lib/types.ts` - DiagramDetailedData interface

## Comparison: Before vs After

### Before (Imagen Only)
```
PDF → Gemini extracts → Description → Imagen generates
                                     ↓
                            "5 cm" becomes "6 cm" ❌
                            "Point A" becomes "Poinr A" ❌
                            Text is blurry ❌
```

### After (Tiered System)
```
PDF → Gemini extracts → Structured data → SVG renders
                                        ↓
                                "5 cm" stays "5 cm" ✅
                                "Point A" stays "Point A" ✅
                                Text is crisp ✅
```

## Example: Triangle with Measurements

**Input (from PDF):**
```
Triangle ABC where:
- AB = 5 cm
- BC = 3 cm
- AC = 4 cm
- Right angle at B
```

**Old System (Imagen):**
```
Result: Image with:
- "5 cm" rendered as "S cm" or "6 cm" ❌
- Text is blurry and hard to read ❌
- Measurements are approximate ❌
```

**New System (SVG):**
```svg
<svg width="600" height="500">
  <!-- Perfect triangle geometry -->
  <path d="M 80 420 L 480 420 L 80 80 Z" stroke="black" />

  <!-- Browser-rendered text (always crisp) -->
  <text x="55" y="425">Point A</text>
  <text x="505" y="425">Point B</text>
  <text x="55" y="65">Point C</text>

  <!-- Exact measurements -->
  <text x="280" y="440">5 cm</text> ✅
  <text x="40" y="250">3 cm</text> ✅
  <text x="290" y="240">4 cm</text> ✅

  <!-- Right angle symbol -->
  <path d="M 95 405 L 95 420 L 80 420" stroke="black" />
</svg>
```

## Testing

### Test with Triangle
1. Extract a paper with a triangle diagram
2. Check console for: `[HybridDiagram] Attempting SVG rendering (Tier 2)...`
3. Verify: `[HybridDiagram] ✓ SVG rendering successful`
4. Result: Crisp text with exact measurements

### Test Fallback
1. Extract a paper with a flowchart
2. SVG renderer will skip it (not supported)
3. System falls back to Mermaid or Imagen
4. Check console for tier progression

## Performance

**SVG Rendering:**
- ✅ Instant (no API calls)
- ✅ No cost
- ✅ Works offline
- ✅ Scalable (vector graphics)

**Imagen (old method):**
- ❌ 2-5 seconds per image
- ❌ $0.02-0.05 per image
- ❌ Requires internet
- ❌ Fixed resolution

## Future Enhancements

### Tier 1: Original PDF Image Extraction
Extract actual diagram images from PDFs during processing:

```typescript
// During PDF extraction
const diagramImage = extractImageFromPDF(pdf, pageNum, bounds);
const diagramImageUri = `data:image/png;base64,${diagramImage}`;

// Save to database
question.diagramOriginalImageUri = diagramImageUri;

// Display directly (zero loss)
<img src={question.diagramOriginalImageUri} />
```

### More SVG Renderers
- Rectangle renderer
- Circle renderer
- Polygon renderer
- Bar chart renderer
- Coordinate graph renderer

### Hybrid Rendering
Show both original and recreation side-by-side for quality comparison.

## Troubleshooting

**SVG not rendering?**
- Check if diagram type is supported: `canRenderAsSVG(detailedData)`
- Verify detailed data exists: `detailedData?.measurements`
- Check console for errors

**Still seeing Imagen?**
- Verify `FORCE_IMAGEN: false` in config
- Check if diagram type is unsupported (will fall back to Imagen)
- Ensure detailed data was extracted during PDF processing

**Text still looks bad?**
- If seeing blurry text, Imagen is being used (Tier 4)
- Check why SVG wasn't used (likely unsupported diagram type)
- Consider adding SVG renderer for that diagram type

## Summary

**Key Achievement:** We've solved Imagen's text rendering problem by implementing programmatic SVG rendering for geometric diagrams. This ensures:

✅ **Perfect text** - Rendered by browser, always crisp
✅ **Exact measurements** - No AI guessing, calculated mathematically
✅ **Zero cost** - No API calls for SVG rendering
✅ **Instant rendering** - No waiting for AI generation
✅ **Scalable** - Vector graphics work at any size

The tiered system ensures we use the best rendering method for each diagram type, with SVG as the primary method for geometric shapes where text accuracy is critical.
