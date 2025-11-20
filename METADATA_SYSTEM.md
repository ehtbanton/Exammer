# Metadata-Based Semantic Diagram System

## Overview

This system uses **natural language metadata** to capture the semantic meaning of geometric diagrams. Instead of complex nested schemas, we use simple text descriptions that both AI and humans can understand.

## How It Works

### 1. Extraction Phase

When extracting diagrams from PDFs, the AI generates:

**Commands** (pure geometry):
```json
{
  "width": 400,
  "height": 300,
  "commands": [
    "P=(50,250)",
    "Q=(350,250)",
    "R=(200,100)",
    "O=(200,250)",
    "Circle(O,150)",
    "Triangle(P,Q,R)",
    "Segment(P,Q)",
    "Label(P,\"P\")",
    "Label(Q,\"Q\")",
    "Label(R,\"R\")",
    "Label(Midpoint(P,R),\"$\\angle$PRQ = 90°\")"
  ]
}
```

**Metadata** (semantic meaning):
```json
{
  "metadata": {
    "description": "Triangle PQR inscribed in a circle with PQ as diameter",

    "relationships": [
      "PQ is the diameter of the circle",
      "P and Q are endpoints of the diameter on the circle",
      "R is a point on the circle",
      "Angle PRQ = 90° (angle inscribed in semicircle)",
      "PR = 22cm",
      "Angle QPR = 35°"
    ],

    "variableElements": [
      "PQ diameter length can change (currently represents 22cm for PR)",
      "Angle QPR can change (currently 35°)",
      "Position of R on circle can change",
      "Overall scale of diagram can change"
    ],

    "constraints": [
      "PQ must remain the diameter",
      "R must remain on the circle",
      "Angle PRQ must remain 90° (inscribed angle theorem)",
      "Triangle must remain inscribed in circle"
    ]
  }
}
```

### 2. Storage

Stored in SQLite `questions.diagram_data` as JSON:
- Simple schema (no complex nesting)
- Human-readable
- Easy to debug
- Works within Gemini API limits

### 3. Variant Generation

When creating question variants, the AI:

1. **Reads the metadata** to understand what can/cannot change
2. **Preserves constraints** (e.g., "Angle PRQ must remain 90°")
3. **Modifies variable elements** (e.g., changes diameter length from 22cm → 18cm)
4. **Updates commands** accordingly
5. **Generates new metadata** for the variant

**Example Variant:**
```json
{
  "width": 400,
  "height": 300,
  "commands": [
    "P=(60,240)",
    "Q=(340,240)",
    "R=(180,120)",
    "O=(200,240)",
    "Circle(O,140)",
    "Triangle(P,Q,R)",
    "Segment(P,Q)",
    "Label(P,\"P\")",
    "Label(Q,\"Q\")",
    "Label(R,\"R\")",
    "Label(Midpoint(P,R),\"$\\angle$PRQ = 90°\")"
  ],
  "metadata": {
    "description": "Triangle PQR inscribed in a circle with PQ as diameter",
    "relationships": [
      "PQ is the diameter of the circle",
      "Angle PRQ = 90° (angle inscribed in semicircle)",
      "PR = 18cm",  // CHANGED
      "Angle QPR = 42°"  // CHANGED
    ],
    "variableElements": [
      "PQ diameter length can change (currently represents 18cm for PR)",  // UPDATED
      "Angle QPR can change (currently 42°)",  // UPDATED
      "Position of R on circle can change",
      "Overall scale of diagram can change"
    ],
    "constraints": [
      "PQ must remain the diameter",
      "R must remain on the circle",
      "Angle PRQ must remain 90° (inscribed angle theorem)",  // PRESERVED
      "Triangle must remain inscribed in circle"  // PRESERVED
    ]
  }
}
```

## Metadata Fields

### `description` (string)
One-sentence summary of what the diagram shows.

**Examples:**
- "A right triangle ABC with right angle at B"
- "Triangle PQR inscribed in a circle with PQ as diameter"
- "Two parallel lines cut by a transversal"
- "A regular hexagon inscribed in a circle"

### `relationships` (array of strings)
Important geometric facts about the diagram.

**Examples:**
- "AB is perpendicular to BC"
- "Angle PRQ = 90° because it's inscribed in a semicircle"
- "Line l is parallel to line m"
- "Point M is the midpoint of segment AB"
- "AB = BC = 5cm (equal sides)"

### `variableElements` (array of strings)
What can safely be changed when creating variants.

**Examples:**
- "AB length can change (currently 6cm)"
- "Angle at A can change (currently 45°)"
- "Overall scale can change"
- "Position of point P along the line can change"
- "Radius of circle can change (currently 5cm)"

### `constraints` (array of strings)
What MUST be preserved in variants (geometric truths).

**Examples:**
- "AB must remain perpendicular to BC"
- "Angle PRQ must remain 90°"
- "Lines l and m must stay parallel"
- "Triangle must remain inscribed in circle"
- "AC length must equal √(AB² + BC²)"
- "Sum of angles in triangle must remain 180°"

## Benefits

### ✅ Simple & Robust
- Arrays of strings - no complex nesting
- Works within Gemini API schema limits
- No proto format errors

### ✅ AI-Friendly
- Natural language is what LLMs do best
- AI can reason about text descriptions
- No need for complex geometric computations

### ✅ Human-Readable
- Teachers can understand what's preserved
- Easy to debug extraction issues
- Clear documentation of geometric meaning

### ✅ Flexible
- Can describe any geometric property
- Not limited to predefined constraint types
- Extensible to 3D, graphs, any diagram type

### ✅ Educational Quality
- Captures "why" not just "what"
- Preserves mathematical relationships
- Ensures variant diagrams are geometrically valid

## Usage Examples

### Example 1: Right Triangle

```json
{
  "commands": ["A=(50,200)", "B=(250,200)", "C=(250,50)", "Triangle(A,B,C)", ...],
  "metadata": {
    "description": "Right triangle ABC with right angle at B",
    "relationships": [
      "AB is horizontal (base)",
      "BC is vertical (height)",
      "AB ⊥ BC (right angle at B)",
      "AB = 6cm, BC = 4cm, AC = √52 cm"
    ],
    "variableElements": [
      "AB length can change",
      "BC length can change",
      "Overall scale can change"
    ],
    "constraints": [
      "AB must stay horizontal",
      "BC must stay vertical",
      "AB ⊥ BC must be preserved",
      "AC = √(AB² + BC²) must hold"
    ]
  }
}
```

### Example 2: Circle with Inscribed Angle

```json
{
  "metadata": {
    "description": "Circle with inscribed angle theorem demonstration",
    "relationships": [
      "Points A, B, C are on the circle",
      "Angle ACB is inscribed in the circle",
      "Arc AB subtends angle ACB",
      "Central angle AOB = 2 × inscribed angle ACB"
    ],
    "variableElements": [
      "Circle radius can change",
      "Position of points on circle can change",
      "Angle ACB can change"
    ],
    "constraints": [
      "All three points must remain on circle",
      "Central angle must be 2× inscribed angle",
      "Inscribed angle theorem must hold"
    ]
  }
}
```

### Example 3: Parallel Lines and Transversal

```json
{
  "metadata": {
    "description": "Two parallel lines cut by a transversal",
    "relationships": [
      "Lines l and m are parallel",
      "Line t is a transversal cutting l and m",
      "Corresponding angles are equal",
      "Alternate interior angles are equal"
    ],
    "variableElements": [
      "Angle of transversal can change",
      "Distance between parallel lines can change",
      "Specific angle measures can change"
    ],
    "constraints": [
      "Lines l and m must remain parallel",
      "Corresponding angles must be equal",
      "Alternate interior angles must be equal",
      "Co-interior angles must sum to 180°"
    ]
  }
}
```

### Example 4: 3D Prism (Advanced)

```json
{
  "metadata": {
    "description": "Solid prism with shaded cross-section",
    "relationships": [
      "Prism has rectangular cross-section",
      "Base dimensions are 14cm × 10cm",
      "Height is 15cm",
      "Volume = 1500cm³",
      "Cross-section area = 100cm²",
      "Height y = Volume ÷ Cross-section area"
    ],
    "variableElements": [
      "Base dimensions can change",
      "Height can change",
      "Volume can change",
      "Overall scale can change"
    ],
    "constraints": [
      "Must remain a rectangular prism",
      "Volume = base area × height must hold",
      "Cross-section must remain rectangular",
      "Proportions must be geometrically valid"
    ]
  }
}
```

## Implementation Details

### File Changes

1. **Schema**: `src/lib/geometric-schema.ts`
   - Added `DiagramMetadata` interface
   - Updated `GeometricDiagram` to include `metadata` field

2. **Extraction**:
   - `src/ai/flows/extract-geometric-diagram.ts`
   - `src/ai/flows/extract-geometric-diagrams-batch.ts`
   - Updated prompts to generate metadata
   - Added schema validation for metadata

3. **Variant Generation**: `src/ai/flows/generate-similar-question.ts`
   - Updated prompt to use metadata when modifying diagrams
   - Emphasizes preserving constraints
   - Generates new metadata for variants

### Database Schema

No changes needed! The `metadata` field is just part of the JSON stored in `questions.diagram_data`.

### Migration

Existing diagrams without metadata will continue to work. The `metadata` field is optional.

## Best Practices

### For AI Extraction

1. **Be specific** in relationships
   - ❌ "Points are related"
   - ✅ "Point M is the midpoint of segment AB"

2. **State the obvious** - what's obvious to humans isn't obvious to AI
   - ✅ "AB is horizontal (y-coordinates are equal)"
   - ✅ "Angle at B is 90° (marked with square)"

3. **Explain why** constraints exist
   - ❌ "Must be 90°"
   - ✅ "Must be 90° because inscribed angle in semicircle"

4. **Be concrete** about what can change
   - ❌ "Some things can change"
   - ✅ "AB length can change from current 6cm to any positive value"

### For Variant Generation

1. **Read metadata first** before modifying anything
2. **Check each constraint** before finalizing changes
3. **Update metadata** to reflect new values
4. **Preserve relationships** mentioned in metadata

## Troubleshooting

### Diagram Not Preserving Relationships

**Check:**
- Are constraints clearly stated in metadata?
- Does the variant generation prompt emphasize metadata?
- Is the AI reading the metadata section?

**Fix:**
- Make constraints more explicit
- Add "MUST BE PRESERVED" emphasis
- Provide example of correct preservation

### Metadata Too Generic

**Check:**
- Is metadata specific to this diagram?
- Are relationships concrete?

**Fix:**
- Add specific measurements
- Include geometric theorems/principles
- Reference specific elements by name

### Variant Generation Ignoring Constraints

**Check:**
- Are constraints in the right format?
- Is the prompt clear about priorities?

**Fix:**
- Emphasize "CRITICAL" or "MUST" in prompts
- Provide examples of good vs bad variants
- Add validation step to check constraints

## Future Enhancements

1. **Automatic constraint validation**
   - Parse metadata constraints
   - Validate commands against them
   - Flag violations automatically

2. **Constraint suggestion**
   - Analyze commands to detect likely constraints
   - Suggest metadata to user for confirmation

3. **Multi-diagram relationships**
   - Describe relationships between multiple diagrams
   - Support sequences or transformations

4. **3D-specific metadata**
   - Projection type (orthographic, perspective)
   - Hidden line handling
   - View angle description

---

**This metadata system provides a simple, robust, AI-friendly way to capture geometric meaning while working within API limitations. It focuses on what AI does best: understanding and generating natural language descriptions.**
