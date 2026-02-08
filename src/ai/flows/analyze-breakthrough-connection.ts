'use server';

/**
 * @fileOverview Analyzes how a breakthrough/development connects to a student's current curriculum.
 * Shows the relevance, connections to specific topics, and suggests how to study it.
 */

import { z } from 'genkit';
import { executeWithManagedKey } from '@/ai/genkit';

const AnalyzeBreakthroughConnectionInputSchema = z.object({
  breakthroughTitle: z.string(),
  breakthroughSummary: z.string(),
  breakthroughSource: z.string(),
  field: z.string(),
  subfield: z.string(),
  level: z.string(),
  topicNames: z.array(z.string()),
  topicDescriptions: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
  })),
});
export type AnalyzeBreakthroughConnectionInput = z.infer<typeof AnalyzeBreakthroughConnectionInputSchema>;

const TopicConnectionSchema = z.object({
  topicName: z.string(),
  connectionStrength: z.enum(['strong', 'moderate', 'tangential']),
  explanation: z.string().describe('How this breakthrough relates to this specific topic'),
  prerequisiteKnowledge: z.array(z.string()).describe('What the student should already know from this topic'),
  newConceptsToLearn: z.array(z.string()).describe('New concepts introduced by this breakthrough'),
});

const AnalyzeBreakthroughConnectionOutputSchema = z.object({
  overallImpact: z.string().describe('2-3 sentence summary of how this changes the field'),
  topicConnections: z.array(TopicConnectionSchema),
  studyPath: z.object({
    immediateSteps: z.array(z.string()).describe('What to do first to understand this breakthrough'),
    deeperExploration: z.array(z.string()).describe('For students who want to dive deeper'),
    practicalApplications: z.array(z.string()).describe('How to apply this knowledge'),
  }),
  suggestedQuestions: z.array(z.object({
    question: z.string(),
    difficulty: z.enum(['foundational', 'intermediate', 'advanced']),
    hint: z.string(),
  })).describe('Practice questions to test understanding of this breakthrough'),
  careerRelevance: z.string().describe('How knowing this affects job prospects'),
});
export type AnalyzeBreakthroughConnectionOutput = z.infer<typeof AnalyzeBreakthroughConnectionOutputSchema>;

export async function analyzeBreakthroughConnection(
  input: AnalyzeBreakthroughConnectionInput
): Promise<AnalyzeBreakthroughConnectionOutput> {
  const startTime = Date.now();
  console.log(`[BreakthroughConnection] Analyzing connection for: ${input.breakthroughTitle}`);

  const result = await executeWithManagedKey(async (ai, flowInput) => {
    const topicList = flowInput.topicDescriptions
      .map(t => `- ${t.name}${t.description ? `: ${t.description}` : ''}`)
      .join('\n');

    const response = await ai.generate({
      model: 'googleai/gemini-flash-latest',
      output: { schema: AnalyzeBreakthroughConnectionOutputSchema },
      prompt: `You are an educational advisor helping a ${flowInput.level} student understand how a recent breakthrough in ${flowInput.field} (${flowInput.subfield}) connects to their current studies.

## The Breakthrough
**Title:** ${flowInput.breakthroughTitle}
**Summary:** ${flowInput.breakthroughSummary}
**Source:** ${flowInput.breakthroughSource}

## Student's Current Topics
${topicList}

## Your Task
Analyze how this breakthrough connects to the student's curriculum and provide:

1. **Overall Impact**: A clear 2-3 sentence explanation of how this changes or advances the field.

2. **Topic Connections**: For each relevant topic from the student's curriculum, explain:
   - How strong the connection is (strong/moderate/tangential)
   - Specific explanation of the relationship
   - What prerequisite knowledge from that topic helps understand this breakthrough
   - What new concepts this breakthrough introduces

3. **Study Path**: Practical guidance for the student:
   - Immediate first steps to understand this breakthrough
   - Deeper exploration for motivated students
   - Practical applications they could try

4. **Practice Questions**: 2-3 questions at different difficulty levels that test understanding of this breakthrough and its implications.

5. **Career Relevance**: How knowing about this affects their job prospects.

Be specific, educational, and encouraging. Connect abstract concepts to concrete examples where possible.`,
    });

    const output = response.output;
    return output || {
      overallImpact: 'Unable to analyze impact.',
      topicConnections: [],
      studyPath: {
        immediateSteps: [],
        deeperExploration: [],
        practicalApplications: [],
      },
      suggestedQuestions: [],
      careerRelevance: 'Unable to determine career relevance.',
    };
  }, input);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[BreakthroughConnection] Analysis complete in ${duration}s`);

  return result;
}
