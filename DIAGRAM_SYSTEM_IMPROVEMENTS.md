# Improved Diagram Generation System

## Overview

The diagram generation system has been completely overhauled to address accuracy issues with mathematical diagrams. The new system extracts detailed structured data during PDF processing and uses it to generate mathematically accurate diagrams.

## Problems Solved

### Previous Issues

1. **Mermaid Misinterpretation**
   - Problem: Mermaid would misinterpret diagram types (e.g., a triangle with measurements became a network graph)
   - Cause: Gemini tried to represent visual diagrams as Mermaid syntax, which doesn't naturally support geometric shapes with measurements

2. **Imagen Value Errors**
   - Problem: Imagen would get numerical values completely wrong (e.g., "5 cm" became "6 cm", "60°" became "55°")
   - Cause: Two-level translation: PDF → Text description → Imagen generation, causing value drift

3. **No Ground Truth**
   - Problem: Original diagram images were never extracted, everything was recreated from AI interpretation
   - Cause: System relied entirely on AI to recreate diagrams from memory

### Solution

The new system extracts **detailed structured data** during PDF processing, capturing every measurement, angle, label, and relationship with exact values.

## Architecture

### 1. Enhanced Extraction (`extract-paper-questions.ts`)

During PDF processing, Gemini now extracts:

```typescript
diagramDetailedData: {
  type: "triangle",              // Specific diagram type
  measurements: {
    lengths: [
      "side AB = 5 cm",
      "side BC = 3 cm",
      "side AC = 4 cm"
    ],
    angles: [
      "angle ABC = 90 degrees",
      "angle BAC = 53.13 degrees",
      "angle BCA = 36.87 degrees"
    ]
  },
  elements: [
    { id: "A", label: "Point A", type: "vertex" },
    { id: "B", label: "Point B", type: "vertex" },
    { id: "C", label: "Point C", type: "vertex" }
  ],
  connections: [
    { from: "A", to: "B", label: "5 cm", type: "side" },
    { from: "B", to: "C", label: "3 cm", type: "side" },
    { from: "C", to: "A", label: "4 cm", type: "side" }
  ],
  specialProperties: [
    "right angle at B",
    "right triangle"
  ]
}
```

**Critical Rules for Extraction:**
- NEVER approximate values - if you see "5.7 cm", record exactly "5.7 cm"
- NEVER omit measurements - include ALL visible values
- For triangles: extract ALL 3 sides, ALL 3 angles, ALL 3 vertices
- If a number appears on the diagram, it MUST be in the data

### 2. Intelligent Generation (`diagram-generation.ts`)

The system now builds hyper-detailed Imagen prompts from structured data:

```typescript
buildAccurateImagenPrompt(detailedData) {
  // Builds prompts like:
  "Create a clean, precise triangle diagram.

  ELEMENTS/POINTS:
  - Point A (vertex)
  - Point B (vertex)
  - Point C (vertex)

  CONNECTIONS:
  - From Point A to Point B labeled '5 cm' (type: side)
  - From Point B to Point C labeled '3 cm' (type: side)
  - From Point C to Point A labeled '4 cm' (type: side)

  LENGTHS (EXACT - DO NOT APPROXIMATE):
  - side AB = 5 cm
  - side BC = 3 cm
  - side AC = 4 cm

  ANGLES (EXACT - DO NOT APPROXIMATE):
  - angle ABC = 90 degrees
  - angle BAC = 53.13 degrees
  - angle BCA = 36.87 degrees

  SPECIAL PROPERTIES:
  - right angle at B
  - right triangle

  CRITICAL REQUIREMENTS:
  - ALL measurements and values listed above MUST be shown exactly as specified
  - This is a mathematical/educational diagram where precision is essential"
}
```

This approach ensures Imagen receives explicit instructions with all exact values, eliminating guesswork.

### 3. Updated Generation Flow (`generate-diagram-image.ts`)

The image generation now checks for detailed data:

```typescript
if (hasDetailedData(input.detailedData)) {
  // Use structured data for maximum accuracy
  prompt = buildAccurateImagenPrompt(input.detailedData);
} else {
  // Fallback to description-based generation
  prompt = `${input.description}\n\nStyle: ${styleInstructions}`;
}
```

### 4. Enhanced Renderer (`hybrid-diagram-renderer.tsx`)

The component now accepts and passes detailed data:

```typescript
<HybridDiagramRenderer
  mermaidCode={question.diagramMermaid}
  detailedData={question.diagramDetailedData} // NEW
  diagramDescription={question.questionText}
  forceImagen={DIAGRAM_CONFIG.FORCE_IMAGEN}
  // ...
/>
```

## Database Schema

New column added to `questions` table:

```sql
diagram_detailed_data TEXT  -- JSON-encoded DiagramDetailedData
```

Migration: Version 7 → Version 8

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. PDF Extraction (extract-paper-questions.ts)             │
│    - Gemini analyzes PDF pages                              │
│    - Extracts ALL measurements with exact values            │
│    - Creates structured DiagramDetailedData                 │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Database Storage                                          │
│    - Stores as JSON in diagram_detailed_data column          │
│    - Preserves ALL exact values and relationships            │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Display/Regeneration (generate-diagram-image.ts)        │
│    - Checks if detailed data available                      │
│    - Builds hyper-detailed Imagen prompt                    │
│    - Imagen generates diagram with exact measurements       │
└─────────────────────────────────────────────────────────────┘
```

## When to Use Each Approach

### Use Detailed Data + Imagen (Recommended for):
- ✅ Triangles with specific measurements
- ✅ Geometric shapes with angles and lengths
- ✅ Circuits with component values
- ✅ Coordinate graphs with specific points
- ✅ Bar charts with exact data values
- ✅ Any diagram where numerical accuracy matters

### Use Mermaid (Suitable for):
- ✅ Flowcharts without measurements
- ✅ Concept maps and mind maps
- ✅ Simple process diagrams
- ✅ Network diagrams (without precise spacing)
- ✅ Timeline diagrams

### Fallback to Description (When):
- ⚠️ Detailed data extraction failed
- ⚠️ No measurements to preserve
- ⚠️ Simple conceptual diagrams

## Configuration

In `src/config/diagram-config.ts`:

```typescript
FORCE_IMAGEN: true  // Use Imagen with detailed data for accuracy
ENABLE_FALLBACK: true  // Fallback if primary method fails
DEFAULT_STYLE: 'technical'  // Clear, precise style for measurements
```

## Testing

To test the new system:

1. **Upload a PDF with mathematical diagrams** (triangles, circuits, etc.)
2. **Check extraction output** - verify `diagramDetailedData` contains exact measurements
3. **View generated diagrams** - confirm values match original
4. **Compare before/after** - old system vs new system accuracy

## Future Enhancements

Potential improvements:

1. **Original Image Extraction**
   - Extract actual diagram images from PDF
   - Store as base64 data URIs
   - Display originals directly (zero loss)

2. **Vision-Based Analysis**
   - Pass diagram images to Gemini Vision
   - Get even more detailed analysis
   - Handle complex diagrams better

3. **Hybrid Rendering**
   - Show original image + generated recreation
   - Allow users to toggle between versions
   - Useful for quality comparison

## Migration Guide

### For Existing Questions

Existing questions without `diagramDetailedData` will:
- Continue working with old description-based generation
- Can be re-extracted to get detailed data
- Gradually improve as PDFs are reprocessed

### For New Features

When building features that display diagrams:

```typescript
import { HybridDiagramRenderer } from '@/components/hybrid-diagram-renderer';

// Pass detailed data when available
<HybridDiagramRenderer
  mermaidCode={question.diagramMermaid}
  detailedData={question.diagramDetailedData}  // ← Include this
  diagramDescription={question.questionText}
  subject={subject.name}
  forceImagen={DIAGRAM_CONFIG.FORCE_IMAGEN}
/>
```

## Files Changed

### Core Implementation
- `src/ai/flows/extract-paper-questions.ts` - Enhanced extraction with detailed data
- `src/ai/flows/generate-diagram-image.ts` - Uses detailed data when available
- `src/lib/diagram-generation.ts` - New utilities for accurate generation
- `src/lib/types.ts` - Added DiagramDetailedData interface

### Components
- `src/components/hybrid-diagram-renderer.tsx` - Accepts and passes detailed data

### Database
- `db/db_vers.json` - Added version 8 migration
- `src/lib/db/schema.sql` - Added diagram_detailed_data column

### Configuration
- `src/config/diagram-config.ts` - Updated documentation

### Analysis Tools (Future Use)
- `src/ai/flows/analyze-diagram-detailed.ts` - Detailed diagram analysis flow
- `src/ai/flows/generate-diagram-from-analysis.ts` - Generation from analysis

## Support

If you encounter issues:

1. Check extraction logs for `diagramDetailedData`
2. Verify measurements are exact (no approximations)
3. Ensure FORCE_IMAGEN is true for math diagrams
4. Review generated Imagen prompts in console

## Summary

**Key Improvement**: The system now extracts and preserves exact measurements during PDF processing, eliminating the accuracy problems that occurred with double-translation through AI systems.

**Result**: Mathematical diagrams are now reproduced with the correct values, angles, and measurements as they appear in the original exam papers.
