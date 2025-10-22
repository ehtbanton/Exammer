'use server';

/**
 * @fileOverview Generates exam-style questions and conducts an interview-style chat to guide the user to the correct answer.
 *
 * - aiPoweredInterview - A function that orchestrates the question generation and interview process.
 * - AIPoweredInterviewInput - The input type for the aiPoweredInterview function.
 * - AIPoweredInterviewOutput - The return type for the aiPoweredInterview function.
 */

import {z} from 'genkit';
import {executeWithManagedKey} from '@/ai/genkit';

const AIPoweredInterviewInputSchema = z.object({
  subsection: z.string().describe('The specific subsection/topic context for the question.'),
  userAnswer: z.string().optional().describe('The user answer to the current question, if any.'),
  previousChatHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional().describe('The previous chat history between the user and the assistant.'),
  question: z.string().describe('The exam question being asked to the student.'),
});
export type AIPoweredInterviewInput = z.infer<typeof AIPoweredInterviewInputSchema>;

const AIPoweredInterviewOutputSchema = z.object({
  nextAssistantMessage: z.string().describe('The next message from the AI assistant in the interview.'),
  isCorrect: z.boolean().optional().describe('Whether the user has answered the question correctly.'),
  score: z.number().optional().describe('The score awarded for answering the question, out of 10.'),
  chatHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).describe('The chat history between the user and the assistant, including the question and all messages.'),
});
export type AIPoweredInterviewOutput = z.infer<typeof AIPoweredInterviewOutputSchema>;

const GenerateQuestionInputSchema = z.object({
  subsection: z.string().describe('The specific subsection to generate a question for.'),
  pastPapers: z.string().describe('A string containing all the past papers to use for RAG.'),
});
export type GenerateQuestionInput = z.infer<typeof GenerateQuestionInputSchema>;

const GenerateQuestionOutputSchema = z.object({
  question: z.string().describe('The generated exam-style question for the subsection.'),
});
export type GenerateQuestionOutput = z.infer<typeof GenerateQuestionOutputSchema>;

export async function aiPoweredInterview(input: AIPoweredInterviewInput): Promise<AIPoweredInterviewOutput> {
  // Use the global API key manager to execute this flow
  return executeWithManagedKey(async (ai, flowInput) => {
    const prompt = ai.definePrompt({
      name: 'aiPoweredInterviewPrompt',
      input: {schema: AIPoweredInterviewInputSchema},
      output: {schema: AIPoweredInterviewOutputSchema},
      prompt: `You are an AI assistant designed to help students learn material by conducting interview-style conversations. You are helping the student answer a real exam question.

Topic context: {{{subsection}}}

The exam question the student is working on:
{{{question}}}

Here's the previous chat history:
{{#each previousChatHistory}}
  {{role}}: {{{content}}}
{{/each}}

{{#if userAnswer}}
  The user has provided the following answer:
  {{{userAnswer}}}

  Based on this answer and typical exam marking criteria for this type of question, provide the next step in the interview process:
  - If the answer is correct and complete according to exam standards, congratulate the user and award a score out of 10 based on the quality, completeness, and accuracy of the answer. Set isCorrect to true.
  - If the answer is partially correct or incomplete, provide encouraging feedback and a helpful hint or follow-up question to guide them towards a more complete answer that would earn full marks.
  - If the answer is incorrect, provide constructive feedback and a guiding question to help them think about the problem differently.

  Use your knowledge of the subject matter from the topic context to assess the answer fairly.
{{else}}
  This is the start of the interview. Provide a brief encouraging message to help the student begin answering the exam question. Do NOT repeat the question - it will be shown separately.
{{/if}}

Output the nextAssistantMessage which contains your next message to the user.
If the question is fully and correctly answered, set the isCorrect boolean to true and award the final score in the score field (out of 10).
Also output the updated chatHistory array, including the user answer (if any) and your assistant message.
`,
    });

    const {
      subsection,
      userAnswer,
      previousChatHistory = [],
      question,
    } = flowInput;

    const {
      output,
    } = await prompt({
      subsection,
      userAnswer,
      previousChatHistory,
      question,
    }, {
      model: 'googleai/gemini-2.5-flash-lite',
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
      question: question || '',
      nextAssistantMessage: output.nextAssistantMessage,
      isCorrect: output.isCorrect,
      score: output.score,
      chatHistory: updatedChatHistory,
    };
  }, input);
}

export async function generateQuestion(input: GenerateQuestionInput): Promise<GenerateQuestionOutput> {
  // Use the global API key manager to execute this flow
  return executeWithManagedKey(async (ai, flowInput) => {
    const questionGenerationPrompt = ai.definePrompt({
      name: 'questionGenerationPrompt',
      input: {schema: GenerateQuestionInputSchema},
      output: {schema: GenerateQuestionOutputSchema},
      prompt: `You are an AI assistant designed to generate exam-style questions for students.

The current subsection is: {{{subsection}}}

Use the following past papers to generate a relevant question:
{{{pastPapers}}}

Generate a challenging, exam-style question that is appropriate for the subsection. The question should:
- Be clear and specific
- Test understanding of key concepts
- Be similar in style to questions from the past papers
- Be answerable based on the material covered

Output only the question in the 'question' field.`,
    });

    const { subsection, pastPapers } = flowInput;

    const { output } = await questionGenerationPrompt({
      subsection,
      pastPapers,
    }, {
      model: 'googleai/gemini-2.5-flash-lite',
    });

    if (!output) {
      throw new Error('AI response was empty.');
    }

    return {
      question: output.question,
    };
  }, input);
}
