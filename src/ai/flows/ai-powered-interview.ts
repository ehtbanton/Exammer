'use server';

/**
 * @fileOverview Generates exam-style questions and conducts an interview-style chat to guide the user to the correct answer.
 *
 * - aiPoweredInterview - A function that orchestrates the question generation and interview process.
 * - AIPoweredInterviewInput - The input type for the aiPoweredInterview function.
 * - AIPoweredInterviewOutput - The return type for the aiPoweredInterview function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AIPoweredInterviewInputSchema = z.object({
  subsection: z.string().describe('The specific subsection to generate a question for.'),
  pastPapers: z.string().describe('A string containing all the past papers to use for RAG.'),
  userAnswer: z.string().optional().describe('The user answer to the current question, if any.'),
  previousChatHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional().describe('The previous chat history between the user and the assistant.'),
  question: z.string().optional().describe('The current question being asked.'),
});
export type AIPoweredInterviewInput = z.infer<typeof AIPoweredInterviewInputSchema>;

const AIPoweredInterviewOutputSchema = z.object({
  question: z.string().describe('The generated question for the subsection.'),
  nextAssistantMessage: z.string().describe('The next message from the AI assistant in the interview.'),
  isCorrect: z.boolean().optional().describe('Whether the user has answered the question correctly.'),
  score: z.number().optional().describe('The score awarded for answering the question, out of 10.'),
  chatHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).describe('The chat history between the user and the assistant, including the question and all messages.'),
});
export type AIPoweredInterviewOutput = z.infer<typeof AIPoweredInterviewOutputSchema>;

export async function aiPoweredInterview(input: AIPoweredInterviewInput): Promise<AIPoweredInterviewOutput> {
  return aiPoweredInterviewFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiPoweredInterviewPrompt',
  input: {schema: AIPoweredInterviewInputSchema},
  output: {schema: AIPoweredInterviewOutputSchema},
  prompt: `You are an AI assistant designed to help students learn material by conducting interview-style questions. Always ask one question at a time.

The current subsection is: {{{subsection}}}

{{#if question}}
The current question is:
{{{question}}}
{{/if}}

Use the following past papers to generate questions and answers:
{{{pastPapers}}}

Here's the previous chat history:
{{#each previousChatHistory}}
  {{role}}: {{{content}}}
{{/each}}

{{#if userAnswer}}
  The user has provided the following answer:
  {{{userAnswer}}}
  Based on this answer, provide the next step in the interview process. If the answer is correct, congratulate the user and award a score out of 10 based on the quality of the answer.
  If the answer is incorrect, provide a helpful hint or a follow-up question to guide the user towards the correct answer.
{{else}}
  Generate an exam-style question for the user based on the subsection and past papers. Start by asking only the question.
{{/if}}

Output the nextAssistantMessage which contains your next message to the user.
If a new question is being generated, output it in the 'question' field.
If the question is fully answered, set the isCorrect boolean and award the final score, setting it in the score field.
Also output the updated chatHistory array, including the user answer and your assistant message.
`,
});

const aiPoweredInterviewFlow = ai.defineFlow(
  {
    name: 'aiPoweredInterviewFlow',
    inputSchema: AIPoweredInterviewInputSchema,
    outputSchema: AIPoweredInterviewOutputSchema,
  },
  async input => {
    const {
      subsection,
      pastPapers,
      userAnswer,
      previousChatHistory = [],
      question,
    } = input;

    const {
      output,
    } = await prompt({
      subsection,
      pastPapers,
      userAnswer,
      previousChatHistory,
      question,
    });
    
    if (!output) {
      throw new Error('AI response was empty.');
    }

    // Update the chat history with the user's answer and the assistant's message.
    const updatedChatHistory = [...previousChatHistory];
    if (userAnswer) {
      updatedChatHistory.push({role: 'user', content: userAnswer});
    }
    updatedChatHistory.push({role: 'assistant', content: output.nextAssistantMessage});

    return {
      question: output.question || question || '',
      nextAssistantMessage: output.nextAssistantMessage,
      isCorrect: output.isCorrect,
      score: output.score,
      chatHistory: updatedChatHistory,
    };
  }
);
