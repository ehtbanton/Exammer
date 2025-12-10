/**
 * @fileOverview Generates concise summaries of interview conversations.
 *
 * - summarizeConversation - Creates a searchable summary of an interview
 *
 * The summary is optimized for:
 * 1. Semantic search (contains key concepts and topics)
 * 2. Employer review (highlights skills demonstrated)
 * 3. Brevity (1-3 sentences max)
 */

import { z } from 'genkit';
import { executeWithManagedKey, ESTIMATED_TOKENS } from '@/ai/genkit';

// Input schema
const SummarizeConversationInputSchema = z.object({
  questionText: z.string().describe('The original exam question'),
  questionTopic: z.string().describe('The topic/subject area'),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).describe('The conversation messages'),
  finalScore: z.number().optional().describe('Final score achieved (0-100)'),
  completedObjectives: z.array(z.string()).optional().describe('Learning objectives completed'),
});

export type SummarizeConversationInput = z.infer<typeof SummarizeConversationInputSchema>;

// Output schema
const SummarizeConversationOutputSchema = z.object({
  summary: z.string().describe('Concise summary of the conversation (1-3 sentences)'),
  keyTopics: z.array(z.string()).describe('Key topics/concepts discussed'),
  skillsDemonstrated: z.array(z.string()).describe('Skills the student demonstrated'),
});

export type SummarizeConversationOutput = z.infer<typeof SummarizeConversationOutputSchema>;

/**
 * Generate a concise, searchable summary of an interview conversation.
 */
export async function summarizeConversation(
  input: SummarizeConversationInput,
  userId?: string
): Promise<SummarizeConversationOutput> {
  // Build conversation transcript
  const transcript = input.messages
    .map(m => `${m.role === 'user' ? 'Student' : 'Interviewer'}: ${m.content}`)
    .join('\n');

  const result = await executeWithManagedKey(async (ai, flowInput) => {
    const prompt = ai.definePrompt({
      name: 'summarizeConversation',
      input: { schema: SummarizeConversationInputSchema },
      output: { schema: SummarizeConversationOutputSchema },
      prompt: `You are summarizing an exam interview conversation for a student portfolio.

The summary should be:
1. Concise (1-3 sentences maximum)
2. Focused on what the student demonstrated
3. Include key academic concepts discussed
4. Suitable for employer review

Question Topic: {{questionTopic}}

Original Question:
{{questionText}}

{{#if finalScore}}
Score Achieved: {{finalScore}}%
{{/if}}

{{#if completedObjectives}}
Objectives Completed:
{{#each completedObjectives}}
- {{this}}
{{/each}}
{{/if}}

Conversation Transcript:
${transcript}

Generate a summary that captures what the student demonstrated and the key concepts covered.`,
    });

    const response = await prompt(flowInput, {
      model: 'googleai/gemini-2.5-flash-lite',
    });

    return response.output;
  }, input, userId, ESTIMATED_TOKENS.SIMPLE_QUERY);

  return result;
}

/**
 * Generate a combined text for embedding from summary data.
 * This creates a rich text representation for semantic search.
 */
export function createEmbeddingText(
  summary: SummarizeConversationOutput,
  questionTopic: string,
  questionText: string
): string {
  const parts = [
    `Topic: ${questionTopic}`,
    `Summary: ${summary.summary}`,
  ];

  if (summary.keyTopics.length > 0) {
    parts.push(`Key concepts: ${summary.keyTopics.join(', ')}`);
  }

  if (summary.skillsDemonstrated.length > 0) {
    parts.push(`Skills demonstrated: ${summary.skillsDemonstrated.join(', ')}`);
  }

  // Include a snippet of the question for context
  const questionSnippet = questionText.length > 200
    ? questionText.substring(0, 200) + '...'
    : questionText;
  parts.push(`Question: ${questionSnippet}`);

  return parts.join('\n');
}
