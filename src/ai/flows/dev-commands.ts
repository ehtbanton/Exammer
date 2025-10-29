'use server';

/**
 * @fileOverview Dev commands for level 3 access users to test and debug the AI interview system.
 */

import {z} from 'genkit';
import {executeWithManagedKey} from '@/ai/genkit';

const DevCommandInputSchema = z.object({
  command: z.string().describe('The dev command to execute (e.g., "fullans")'),
  question: z.string().describe('The exam question being worked on'),
  subsection: z.string().describe('The topic/subsection context'),
});
export type DevCommandInput = z.infer<typeof DevCommandInputSchema>;

const DevCommandOutputSchema = z.object({
  generatedAnswer: z.string().describe('The AI-generated answer to the question'),
  isDevCommand: z.boolean().describe('Flag indicating this was a dev command execution'),
});
export type DevCommandOutput = z.infer<typeof DevCommandOutputSchema>;

/**
 * Execute a dev command
 * Currently supports:
 * - "fullans": Generate a complete answer to the question
 */
export async function executeDevCommand(input: DevCommandInput): Promise<DevCommandOutput> {
  const { command, question, subsection } = input;

  if (command === 'fullans') {
    // Generate a complete answer to the question using Gemini
    return executeWithManagedKey(async (ai) => {
      const response = await ai.generate({
        model: 'googleai/gemini-2.5-flash-lite',
        prompt: `You are a student answering an exam question. Provide a complete, detailed answer to the following question.

Topic context: ${subsection}

Question:
${question}

Provide a comprehensive answer that would earn full marks. Be thorough and include all necessary details, explanations, and reasoning.`,
      });

      return {
        generatedAnswer: response.text,
        isDevCommand: true,
      };
    }, input);
  }

  throw new Error(`Unknown dev command: ${command}`);
}

