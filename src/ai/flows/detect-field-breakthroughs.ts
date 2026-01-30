'use server';

/**
 * @fileOverview Detects recent breakthroughs and developments in a subject's academic field.
 * Uses Google Search grounding to find real-world developments that students should know about.
 * This is the fallback when no similar subjects exist on the platform for cross-curriculum comparison.
 *
 * - detectFieldBreakthroughs - Finds recent developments in a field
 * - DetectFieldBreakthroughsInput - Input type
 * - DetectFieldBreakthroughsOutput - Output type
 */

import { z } from 'genkit';
import { executeWithManagedKey } from '@/ai/genkit';

const DetectFieldBreakthroughsInputSchema = z.object({
  field: z.string().describe('Broad academic field, e.g., "Computer Science"'),
  subfield: z.string().describe('Specific subfield, e.g., "Deep Learning"'),
  level: z.string().describe('Academic level, e.g., "Undergraduate"'),
  topicNames: z.array(z.string()).describe('Topics the student is currently studying'),
});
export type DetectFieldBreakthroughsInput = z.infer<typeof DetectFieldBreakthroughsInputSchema>;

const BreakthroughSchema = z.object({
  title: z.string().describe('Concise title of the development/breakthrough'),
  summary: z.string().describe('2-3 sentence summary explaining what happened and why it matters'),
  source: z.string().describe('Where/when this was announced or published, e.g., "Published in Nature, March 2025"'),
  relevance: z.string().describe('Why a student studying this field should know about this'),
  relatedTopics: z.array(z.string()).describe('Which of the student\'s current topics this relates to'),
  employabilityImpact: z.enum(['high', 'medium', 'low']).describe('How much not knowing this would disadvantage a job seeker'),
});

const DetectFieldBreakthroughsOutputSchema = z.object({
  breakthroughs: z.array(BreakthroughSchema).describe('3-5 significant recent developments'),
});
export type DetectFieldBreakthroughsOutput = z.infer<typeof DetectFieldBreakthroughsOutputSchema>;

export async function detectFieldBreakthroughs(
  input: DetectFieldBreakthroughsInput
): Promise<DetectFieldBreakthroughsOutput> {
  const startTime = Date.now();
  console.log(`[Breakthroughs] Searching for developments in ${input.field} / ${input.subfield}`);

  const result = await executeWithManagedKey(async (ai, flowInput) => {
    const currentYear = new Date().getFullYear();

    // Note: Google Search grounding cannot be used with structured JSON output,
    // so we ask for JSON in the prompt and parse it manually
    const response = await ai.generate({
      model: 'googleai/gemini-flash-latest',
      config: {
        googleSearchRetrieval: true,
      },
      prompt: `You are an academic career advisor helping a ${flowInput.level} student studying ${flowInput.field} (specifically ${flowInput.subfield}).

The student is currently learning these topics:
${flowInput.topicNames.map(t => `- ${t}`).join('\n')}

**Your task:** Search for and identify 3-5 significant recent developments, breakthroughs, or industry changes in ${flowInput.subfield} from the past 2-3 years (${currentYear - 2} to ${currentYear}) that:

1. Would put the student at a **significant disadvantage in employment** if they didn't know about them
2. Are NOT already covered in standard ${flowInput.level} textbooks
3. Represent genuine shifts in the field (new techniques, paradigm changes, major discoveries, industry adoptions)

**Search the web** for the latest developments. Focus on:
- Major research papers and their real-world impact
- Industry tool/framework changes (e.g., new standard libraries, deprecated approaches)
- Regulatory or methodological shifts
- Breakthrough applications that changed the field

Be specific and factual. Do not fabricate sources or dates.

**IMPORTANT: Return your response as a JSON object with this exact structure:**
{
  "breakthroughs": [
    {
      "title": "Clear title of the development",
      "summary": "2-3 sentence summary a student can understand",
      "source": "Journal/conference/company and date, e.g., 'Published in Nature, March 2025'",
      "relevance": "Why a student studying this field should know about this",
      "relatedTopics": ["topic1", "topic2"],
      "employabilityImpact": "high" | "medium" | "low"
    }
  ]
}

employabilityImpact meanings:
- "high" = employers expect you to know this
- "medium" = gives you an edge
- "low" = nice to know

Return ONLY the JSON object, no other text.`,
    });

    // Parse the response text as JSON
    const text = response.text?.trim() || '{"breakthroughs": []}';

    // Extract JSON from the response (handle markdown code blocks)
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    try {
      const parsed = JSON.parse(jsonStr);
      // Validate with schema
      const validated = DetectFieldBreakthroughsOutputSchema.safeParse(parsed);
      if (validated.success) {
        return validated.data;
      } else {
        console.warn('[Breakthroughs] Schema validation failed:', validated.error);
        // Try to salvage what we can
        return {
          breakthroughs: Array.isArray(parsed.breakthroughs)
            ? parsed.breakthroughs.map((b: any) => ({
                title: b.title || 'Unknown',
                summary: b.summary || '',
                source: b.source || 'Unknown source',
                relevance: b.relevance || '',
                relatedTopics: Array.isArray(b.relatedTopics) ? b.relatedTopics : [],
                employabilityImpact: ['high', 'medium', 'low'].includes(b.employabilityImpact)
                  ? b.employabilityImpact
                  : 'medium',
              }))
            : [],
        };
      }
    } catch (parseError) {
      console.error('[Breakthroughs] Failed to parse JSON response:', parseError);
      console.error('[Breakthroughs] Raw response:', text);
      return { breakthroughs: [] };
    }
  }, input);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[Breakthroughs] Found ${result.breakthroughs.length} developments in ${duration}s`);

  return result;
}
