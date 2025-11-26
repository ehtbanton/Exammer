'use server';

/**
 * @fileOverview Cheat commands for level 2+ access users to quickly generate answers during testing.
 */

import {z} from 'genkit';
import {executeWithManagedKey} from '@/ai/genkit';

const DevCommandInputSchema = z.object({
  command: z.string().describe('The cheat command to execute (e.g., "fullans", "objans", "objans 2")'),
  question: z.string().describe('The exam question being worked on'),
  subsection: z.string().describe('The topic/subsection context'),
  solutionObjectives: z.array(z.string()).optional().describe('The solution objectives for this question'),
  completedObjectives: z.array(z.number()).optional().describe('Array of indices of completed objectives'),
});
export type DevCommandInput = z.infer<typeof DevCommandInputSchema>;

const DevCommandOutputSchema = z.object({
  generatedAnswer: z.string().describe('The AI-generated answer to the question'),
  isDevCommand: z.boolean().describe('Flag indicating this was a cheat command execution'),
});
export type DevCommandOutput = z.infer<typeof DevCommandOutputSchema>;

/**
 * Execute a cheat command
 * Currently supports:
 * - "fullans": Generate a complete answer to the question
 * - "objans": Generate an answer for the lowest unachieved objective
 * - "objans N": Generate an answer for objective at index N
 * - "objans a": Generate answers for all unachieved objectives
 */
export async function executeDevCommand(input: DevCommandInput): Promise<DevCommandOutput> {
  const { command, question, subsection, solutionObjectives, completedObjectives } = input;

  if (command === 'fullans') {
    // Generate a complete answer to the question using Gemini
    return executeWithManagedKey(async (ai) => {
      const response = await ai.generate({
        model: 'googleai/gemini-flash-lite-latest',
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

  // Handle objans and "objans N" and "objans a" commands
  if (command.startsWith('objans')) {
    if (!solutionObjectives || solutionObjectives.length === 0) {
      throw new Error('No solution objectives available for this question');
    }
    if (!completedObjectives) {
      throw new Error('Completed objectives not provided');
    }

    // Parse the command to check if an index or "a" was specified
    const parts = command.trim().split(/\s+/);

    // Handle "objans a" - answer all unachieved objectives
    if (parts.length > 1 && parts[1].toLowerCase() === 'a') {
      const unachievedIndices = Array.from({ length: solutionObjectives.length }, (_, i) => i)
        .filter(i => !completedObjectives.includes(i));

      if (unachievedIndices.length === 0) {
        throw new Error('All objectives have been completed!');
      }

      // Generate answers for all unachieved objectives
      return executeWithManagedKey(async (ai) => {
        const answers: string[] = [];

        for (const objIndex of unachievedIndices) {
          const targetObjective = solutionObjectives[objIndex];
          const response = await ai.generate({
            model: 'googleai/gemini-flash-lite-latest',
            prompt: `You are a student answering an exam question. You need to provide a specific part of your answer that addresses the following objective.

Topic context: ${subsection}

Full Question:
${question}

Target Objective (index ${objIndex}):
${targetObjective}

Provide a concise answer that specifically addresses this objective. Focus only on what's needed to satisfy this particular marking point. Be natural and sound like a student - don't mention the objective number or that you're answering a specific part.`,
          });

          answers.push(response.text);
        }

        // Combine all answers with spacing
        const combinedAnswer = answers.join('\n\n');

        return {
          generatedAnswer: combinedAnswer,
          isDevCommand: true,
        };
      }, input);
    }

    let targetObjectiveIndex: number;

    if (parts.length > 1) {
      // User specified an index like "objans 2"
      const specifiedIndex = parseInt(parts[1], 10);
      if (isNaN(specifiedIndex) || specifiedIndex < 0 || specifiedIndex >= solutionObjectives.length) {
        throw new Error(`Invalid objective index. Must be between 0 and ${solutionObjectives.length - 1}`);
      }
      targetObjectiveIndex = specifiedIndex;
    } else {
      // Find the lowest-index unachieved objective
      const unachievedIndices = Array.from({ length: solutionObjectives.length }, (_, i) => i)
        .filter(i => !completedObjectives.includes(i));

      if (unachievedIndices.length === 0) {
        throw new Error('All objectives have been completed!');
      }
      targetObjectiveIndex = unachievedIndices[0];
    }

    const targetObjective = solutionObjectives[targetObjectiveIndex];

    // Generate an answer specifically for this objective
    return executeWithManagedKey(async (ai) => {
      const response = await ai.generate({
        model: 'googleai/gemini-flash-lite-latest',
        prompt: `You are a student answering an exam question. You need to provide a specific part of your answer that addresses the following objective.

Topic context: ${subsection}

Full Question:
${question}

Target Objective (index ${targetObjectiveIndex}):
${targetObjective}

Provide a concise answer that specifically addresses this objective. Focus only on what's needed to satisfy this particular marking point. Be natural and sound like a student - don't mention the objective number or that you're answering a specific part.`,
      });

      return {
        generatedAnswer: response.text,
        isDevCommand: true,
      };
    }, input);
  }

  throw new Error(`Unknown cheat command: ${command}`);
}

