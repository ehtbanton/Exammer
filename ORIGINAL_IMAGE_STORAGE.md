# Original Diagram Image Storage & Value Replacement System

## The Ultimate Solution: Use the Real Diagrams

Instead of asking AI to recreate diagrams (which leads to errors), we should:

1. **Extract the actual diagram images from PDFs** during processing
2. **Store them in the database** as the source of truth
3. **Use image editing to change values** for question variants (not regeneration)

This gives us **100% accuracy** - we're using the real exam diagrams!

## Why This is Better Than Everything Else

| Approach | Text Quality | Value Accuracy | Cost | Speed |
|----------|--------------|----------------|------|-------|
| ❌ Imagen Regeneration | Terrible (misspells, blurry) | Wrong (AI guesses) | $0.02-0.05 | 2-5s |
| ✅ SVG Programmatic | Perfect (browser text) | Perfect (calculated) | $0 | Instant |
| ⭐ **Original Image** | **Perfect (actual diagram)** | **Perfect (unchanged)** | **$0** | **Instant** |

**Original images = The actual diagrams from exam papers with zero modifications**

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ 1. PDF Extraction                                       │
│    ├─ Gemini identifies diagram presence                │
│    ├─ Extract diagram image from PDF page               │
│    └─ Save as base64 data URI                          │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Database Storage                                      │
│    ├─ diagram_original_image_uri: base64 data URI      │
│    ├─ diagram_detailed_data: structured measurements    │
│    └─ Store both for different purposes                 │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Question Display (Master Question)                   │
│    └─ Show original image directly (Tier 1)             │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Variant Generation (with different values)           │
│    ├─ Option A: Image editing (overlay new values)      │
│    ├─ Option B: SVG render with new values             │
│    └─ Option C: Show original + text note "values      │
│         changed to X, Y, Z"                             │
└─────────────────────────────────────────────────────────┘
```

## Database Schema

**Added in Migration v9:**

```sql
ALTER TABLE questions ADD COLUMN diagram_original_image_uri TEXT;
```

```typescript
export interface ExamQuestion {
  // ...existing fields...
  diagramOriginalImageUri?: string | null; // The actual diagram from the PDF
  diagramDetailedData?: DiagramDetailedData | null; // Structured data for variants
  // ...
}
```

## Tier 1 Rendering (HybridDiagramRenderer)

```typescript
// NEW: Tier 1 - Original image takes absolute priority
if (originalImageUri) {
  return (
    <div>
      <img src={originalImageUri} alt="Original diagram" />
      <div className="badge">Original (100%)</div>
    </div>
  );
}

// Tier 2: SVG (if original not available)
if (detailedData && canRenderAsSVG(detailedData)) {
  const svg = renderDiagramAsSVG(detailedData);
  return <img src={svgToDataUri(svg)} />;
}

// Tier 3: Mermaid
// Tier 4: Imagen (last resort)
```

## PDF Image Extraction Approaches

### Approach 1: Gemini Vision with Cropping (Recommended)

```typescript
// 1. Ask Gemini to identify diagram bounds
const bounds = await identifyDiagramBounds(pdfPage);
// Returns: { x: 100, y: 200, width: 400, height: 300 }

// 2. Extract that region from PDF
const diagramImage = await extractPDFRegion(pdfPage, bounds);
// Returns: base64 encoded image

// 3. Store in database
question.diagram Original ImageUri = `data:image/png;base64,${diagramImage}`;
```

**Pros:**
- Gets the exact diagram region
- High quality
- Preserves original formatting

**Cons:**
- Requires PDF parsing library
- More complex implementation

### Approach 2: Screenshot-Based Extraction

```typescript
// 1. Render PDF page
const pageImage = await renderPDFPage(pdfFile, pageNumber);

// 2. Ask Gemini to identify diagram region in the image
const bounds = await gemini.identifyDiagramRegion(pageImage);

// 3. Crop the image
const diagramImage = cropImage(pageImage, bounds);

// 4. Store
question.diagramOriginalImageUri = diagramImage;
```

**Pros:**
- Simpler - works with rendered pages
- Can use Gemini's vision for bounds detection

**Cons:**
- Quality depends on rendering resolution
- Extra rendering step

### Approach 3: Manual Extraction (Short-term)

```typescript
// For now, allow manual uploads during extraction
// Admin UI: "Upload diagram image for Question 5"
// This lets us start using the feature immediately
```

**Pros:**
- Works immediately
- Perfect for testing

**Cons:**
- Manual work required
- Not scalable

## Variant Generation with Value Replacement

When generating question variants with different values, we have three options:

### Option 1: Image Editing/Overlay ⭐ BEST FOR SIMPLE CHANGES

```typescript
// Use canvas API to overlay new values on original image
async function replaceValuesInImage(
  originalImageUri: string,
  valueReplacements: { old: string; new: string; position: {x, y} }[]
): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // 1. Draw original image
  const img = await loadImage(originalImageUri);
  ctx.drawImage(img, 0, 0);

  // 2. White out old values
  valueReplacements.forEach(({position}) => {
    ctx.fillStyle = 'white';
    ctx.fillRect(position.x - 5, position.y - 15, 50, 20);
  });

  // 3. Draw new values
  ctx.font = '16px Arial';
  ctx.fillStyle = 'black';
  valueReplacements.forEach(({new: newValue, position}) => {
    ctx.fillText(newValue, position.x, position.y);
  });

  return canvas.toDataURL();
}

// Usage
const variantImage = await replaceValuesInImage(
  originalImageUri,
  [
    { old: "5 cm", new: "7 cm", position: {x: 100, y: 200} },
    { old: "3 cm", new: "4 cm", position: {x: 300, y: 400} }
  ]
);
```

**Pros:**
- Uses actual original diagram
- Only changes what needs to change
- Looks authentic

**Cons:**
- Need to know positions of values
- Text might not match original font perfectly

### Option 2: SVG Re-render with New Values ⭐ BEST FOR GEOMETRIC SHAPES

```typescript
// Use structured data to render with new values
const variantData = {
  ...detailedData,
  measurements: {
    lengths: ["AB = 7 cm", "BC = 4 cm", "AC = 8.1 cm"], // NEW VALUES
    angles: [...] // recalculated
  }
};

const variantImage = renderDiagramAsSVG(variantData);
```

**Pros:**
- Mathematically accurate
- Perfect text rendering
- Easy to implement

**Cons:**
- Only works for supported diagram types
- Doesn't look exactly like original

### Option 3: Original + Text Note ⭐ BEST FOR COMPLEX DIAGRAMS

```typescript
// Show original image with a note about changed values
<div>
  <img src={originalImageUri} />
  <div className="value-changes">
    Note: In this variant, values have been changed:
    - Side AB: 5 cm → 7 cm
    - Side BC: 3 cm → 4 cm
    - All angles adjusted accordingly
  </div>
</div>
```

**Pros:**
- Uses original (perfect quality)
- Clear about what changed
- Works for any diagram

**Cons:**
- Student has to mentally substitute values
- Less seamless than other options

## Implementation Plan

### Phase 1: Original Image Storage ✅ DONE
- [x] Add `diagram_original_image_uri` column
- [x] Update TypeScript types
- [x] Update HybridDiagramRenderer to prioritize originals
- [x] Add migration (v9)

### Phase 2: PDF Image Extraction (Coming Soon)
- [ ] Research PDF parsing libraries for Node.js
- [ ] Implement Gemini-based diagram bounds detection
- [ ] Create extraction utility function
- [ ] Update extraction flow to capture images
- [ ] Test with real exam papers

### Phase 3: Value Replacement System (Coming Soon)
- [ ] Implement canvas-based image editing
- [ ] Create value position detection (using structured data)
- [ ] Build variant generation with value replacement
- [ ] Add UI controls for manual position adjustment
- [ ] Test with various diagram types

### Phase 4: Optimization
- [ ] Implement image compression
- [ ] Add caching for frequently used diagrams
- [ ] Optimize database storage (consider external storage)
- [ ] Add fallback chain if original not available

## Testing

### Test Original Image Display
1. Manually add `diagramOriginalImageUri` to a question in database
2. View that question
3. Should see original image with "Original (100%)" badge
4. Should NOT see SVG/Imagen/Mermaid rendering

### Test Fallback Chain
1. Question with NO original image
2. Should fall back to SVG (if geometric)
3. Then to Mermaid (if flowchart)
4. Finally to Imagen (if nothing else works)

### Test Value Replacement (when implemented)
1. Generate variant from question with original image
2. Should show original with modified values
3. Values should be legible and positioned correctly

## Benefits Summary

✅ **100% accuracy** - Using actual exam diagrams
✅ **Perfect quality** - No AI interpretation errors
✅ **Zero cost** - No Imagen API calls for display
✅ **Instant display** - No generation time
✅ **Authentic appearance** - Looks exactly like exam paper
✅ **Student familiarity** - Students see real exam diagrams

## Future Enhancements

### Intelligent Value Position Detection
Use Gemini Vision to automatically detect value positions:

```typescript
const positions = await detectValuePositions(originalImageUri, detailedData);
// Returns: [{ value: "5 cm", x: 100, y: 200 }, ...]
```

### Variant Preview System
Before generating variants, show preview of value replacements:

```
Original: 5 cm → Variant: 7 cm ✓
Original: 3 cm → Variant: 4 cm ✓
Preview looks good? [Generate Variant]
```

### Bulk Image Extraction
Process entire exam papers at once:

```
Extracting images from Paper-2-2023...
✓ Question 1: Diagram extracted (triangle)
✓ Question 3: Diagram extracted (bar chart)
✓ Question 7: No diagram
✓ Question 9: Diagram extracted (circuit)

4/10 questions have diagrams - all extracted successfully
```

## Conclusion

Original image storage is the ultimate solution for diagram accuracy:
- **Tier 1** (Original) beats everything else
- **Tier 2** (SVG) is excellent fallback
- **Tier 3** (Mermaid) for flowcharts
- **Tier 4** (Imagen) only when nothing else works

By storing and using original images, we eliminate all the text rendering problems and give students exactly what they'll see on the actual exam.
