'use server';

/**
 * @fileOverview Analyzes user performance data to identify weak topics needing improvement.
 *
 * - analyzeWeakTopics - Identifies topics where user needs improvement
 * - AnalyzeWeakTopicsInput - The input type for the analyzeWeakTopics function
 * - AnalyzeWeakTopicsOutput - The return type for the analyzeWeakTopics function
 */

import { z } from 'genkit';
import { executeWithManagedKey } from '@/ai/genkit';

const TopicPerformanceSchema = z.object({
  subjectName: z.string(),
  paperTypeName: z.string(),
  topicName: z.string(),
  topicId: z.number(),
  averageScore: z.number(),
  totalAttempts: z.number(),
  questionsCount: z.number(),
});

const WeakTopicRecommendationSchema = z.object({
  topicId: z.number().describe('ID of the topic that needs improvement'),
  topicName: z.string().describe('Name of the topic'),
  subjectName: z.string().describe('Name of the subject this topic belongs to'),
  paperTypeName: z.string().describe('Name of the paper type'),
  priority: z.enum(['high', 'medium', 'low']).describe('Priority level for improvement'),
  reasoning: z.string().describe('Why this topic needs attention (1-2 sentences)'),
  recommendedFocus: z.string().describe('Specific aspect to focus on improving'),
});

const AnalyzeWeakTopicsInputSchema = z.object({
  topicsPerformance: z.array(TopicPerformanceSchema).describe('User performance data for all topics'),
  requiredSubjects: z.array(z.string()).optional().describe('Subjects required for university goal'),
  targetGrades: z.record(z.string()).optional().describe('Target grades for each subject (e.g., {"Mathematics": "A*"})'),
});
export type AnalyzeWeakTopicsInput = z.infer<typeof AnalyzeWeakTopicsInputSchema>;

const AnalyzeWeakTopicsOutputSchema = z.object({
  weakTopics: z.array(WeakTopicRecommendationSchema).describe('Up to 10 topics that need improvement, prioritized'),
  overallAssessment: z.string().describe('Brief overall assessment of performance (2-3 sentences)'),
});
export type AnalyzeWeakTopicsOutput = z.infer<typeof AnalyzeWeakTopicsOutputSchema>;

/**
 * Analyzes user performance to identify weak topics needing improvement
 */
export async function analyzeWeakTopics(
  input: AnalyzeWeakTopicsInput
): Promise<AnalyzeWeakTopicsOutput> {
  return await executeWithManagedKey(async (ai) => {
    const analyzePrompt = ai.definePrompt({
      name: 'analyzeWeakTopics',
      input: {
        schema: AnalyzeWeakTopicsInputSchema,
      },
      output: {
        schema: AnalyzeWeakTopicsOutputSchema,
      },
      prompt: `You are an expert tutor analyzing a student's exam performance to identify areas for improvement.

**Performance Data:**

{{#each topicsPerformance}}
- **{{subjectName}} - {{paperTypeName}} - {{topicName}}**
  - Average Score: {{averageScore}}%
  - Questions Attempted: {{questionsCount}}
  - Total Attempts: {{totalAttempts}}
{{/each}}

{{#if requiredSubjects}}
**Required Subjects for University Goal:** {{#each requiredSubjects}}{{this}}, {{/each}}
{{/if}}

{{#if targetGrades}}
**Target Grades:**
{{#each targetGrades}}
- {{@key}}: {{this}}
{{/each}}
{{/if}}

**Task:**

Identify **up to 10 topics** where the student needs improvement, prioritized by:
1. **Low scores** (below 70% is concerning, below 50% is critical)
2. **Required subjects** (topics in subjects needed for university goal are higher priority)
3. **Engagement** (topics with few attempts may need encouragement)
4. **Impact** (foundational topics that affect other areas)

**Guidelines:**

1. **Priority Levels:**
   - **High**: Score < 50%, or score < 70% in required subject
   - **Medium**: Score 50-70%, or important foundational topic
   - **Low**: Score 70-85%, minor gaps

2. **Reasoning**: Explain why this topic needs attention
   - Reference the score
   - Mention if it's required for university goal
   - Note if it's foundational for other topics

3. **Recommended Focus**: Be specific about what to improve
   - "Practice calculation accuracy under time pressure"
   - "Review core concepts before attempting harder questions"
   - "Focus on exam technique and marking criteria"

4. **Overall Assessment**: Summarize the student's performance
   - Strengths (what they're doing well)
   - Key areas for improvement
   - Encouragement and next steps

**Output Requirements:**
- Return topics in priority order (high → medium → low)
- Maximum 10 topics
- If student is doing well everywhere (all > 85%), return fewer topics with "low" priority
- Be constructive and encouraging

Generate the analysis now.`,
    }, { model: 'googleai/gemini-2.0-flash-exp' });

    const result = await analyzePrompt(input);

    return result.output;
  });
}
