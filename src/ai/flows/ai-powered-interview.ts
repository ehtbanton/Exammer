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
  userImage: z.string().optional().describe('Base64-encoded image of the user whiteboard answer, if any.'),
  previousChatHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    imageUrl: z.string().optional(),
  })).optional().describe('The previous chat history between the user and the assistant.'),
  question: z.string().describe('The exam question being asked to the student.'),
  solutionObjectives: z.array(z.string()).describe('List of specific marking objectives/criteria that the student must achieve to gain full marks.'),
  previouslyCompletedObjectives: z.array(z.number()).optional().describe('Array of objective indices (0-based) that the user has already completed. These cannot be undone.'),
});
export type AIPoweredInterviewInput = z.infer<typeof AIPoweredInterviewInputSchema>;

const AIPoweredInterviewOutputSchema = z.object({
  nextAssistantMessage: z.string().describe('The next message from the AI assistant in the interview.'),
  completedObjectives: z.array(z.number()).describe('Array of objective indices (0-based) that the user has now achieved.'),
  hints: z.array(z.string()).describe('Helpful hints for objectives that have not yet been achieved.'),
  chatHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    imageUrl: z.string().optional(),
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
      prompt: `You are Xam, a friendly AI teaching assistant acting as an exam marker. You are checking a student's work against the official markscheme for a real exam question, just like a teacher would do when marking exams.

Topic context: {{{subsection}}}

The exam question the student is working on:
{{{question}}}

Official Markscheme Objectives (Solution Steps):
These objectives represent the marking criteria from the official markscheme. Each objective is a specific step, calculation, or answer that earns marks. The student must demonstrate each one to get full marks.

{{#each solutionObjectives}}
  [{{@index}}] {{{this}}}
{{/each}}

Previously Completed Objectives (IMMUTABLE - cannot be removed):
{{#if previouslyCompletedObjectives}}
  {{#each previouslyCompletedObjectives}}
    [{{this}}] ✓
  {{/each}}
{{else}}
  None yet
{{/if}}

Here's the previous chat history:
{{#each previousChatHistory}}
  {{role}}: {{{content}}}{{#if imageUrl}} [Image provided]{{/if}}
{{/each}}

{{#if userAnswer}}
  The user has provided the following answer:
  {{{userAnswer}}}
{{/if}}
{{#if userImage}}
  The user has also provided a whiteboard drawing (image will be included in the request).
{{/if}}

{{#if userAnswer}}

  Your task is to CHECK THE STUDENT'S WORK AGAINST THE MARKSCHEME:

  1. Review each marking objective carefully
  2. Check if the student has demonstrated that specific objective in their answer
  3. Tick off (mark as complete) any objectives where the student has provided the correct step/answer
  4. Think like a teacher marking an exam: Has the student shown this specific step/formula/answer/reasoning from the markscheme?

  MARKING CRITERIA:
  - Each objective represents a specific mark-earning point from the markscheme
  - Tick off an objective ONLY if the student has demonstrated that specific criterion
  - For numeric objectives: Check if the student calculated or stated the correct value
  - For formulaic objectives: Check if the student used the correct formula or substitution
  - For explanation objectives: Check if the student provided the required reasoning/explanation
  - Previously completed objectives are IMMUTABLE - always include them (they cannot be uncompleted)

  IMPORTANT:
  - Be fair but strict, like a real exam marker following the markscheme
  - Only award marks (tick objectives) when clearly earned
  - If the student provides a correct answer step that matches an objective, tick it off
  - Previously completed objectives CANNOT be removed - always include them in completedObjectives
  - Do NOT reveal the exact wording of incomplete objectives - give hints instead
  - Provide encouraging feedback about what they've achieved and what to work on next

{{else}}
  This is the start of the interview. Provide a brief encouraging message to help the student begin answering the exam question. Do NOT repeat the question or reveal the marking objectives - they will discover them through their work as they provide answers.
{{/if}}

Output:
- nextAssistantMessage: Your encouraging feedback to the student
- completedObjectives: Array of objective indices (0-based) that are now complete (MUST include all previously completed)
- hints: Array of helpful hints for objectives not yet achieved (do not reveal exact objective wording)
- chatHistory: Updated conversation history
`,
    });

    const {
      subsection,
      userAnswer,
      userImage,
      previousChatHistory = [],
      question,
      solutionObjectives,
      previouslyCompletedObjectives = [],
    } = flowInput;

    // For Genkit with images, we need to use the generate function directly
    // because definePrompt doesn't handle multimodal input properly
    if (userImage) {
      // Use direct generate call with multimodal content
      const objectivesList = solutionObjectives.map((obj, idx) => `[${idx}] ${obj}`).join('\n  ');
      const completedList = previouslyCompletedObjectives.length > 0
        ? previouslyCompletedObjectives.map(idx => `[${idx}]`).join(', ')
        : 'None yet';

      const response = await ai.generate({
        model: 'googleai/gemini-3-flash-preview',
        prompt: [
          {text: `You are Xam, a friendly AI teaching assistant acting as an exam marker. You are checking a student's work against the official markscheme for a real exam question, just like a teacher would do when marking exams.

Topic context: ${subsection}

The exam question the student is working on:
${question}

Official Markscheme Objectives (Solution Steps):
These objectives represent the marking criteria from the official markscheme. Each objective is a specific step, calculation, or answer that earns marks. The student must demonstrate each one to get full marks.

  ${objectivesList}

Previously Completed Objectives (IMMUTABLE - cannot be removed):
  ${completedList}

Here's the previous chat history:
${previousChatHistory.map(msg => `${msg.role}: ${msg.content}${msg.imageUrl ? ' [Image provided]' : ''}`).join('\n')}

The user has provided a whiteboard drawing (see image) ${userAnswer ? `and the following text answer: ${userAnswer}` : ''}.

Your task is to CHECK THE STUDENT'S WORK AGAINST THE MARKSCHEME:

1. Review each marking objective carefully
2. Check if the student has demonstrated that specific objective in their answer (text or image)
3. Tick off (mark as complete) any objectives where the student has provided the correct step/answer
4. Think like a teacher marking an exam: Has the student shown this specific step/formula/answer/reasoning from the markscheme?

MARKING CRITERIA:
- Each objective represents a specific mark-earning point from the markscheme
- Tick off an objective ONLY if the student has demonstrated that specific criterion
- For numeric objectives: Check if the student calculated or stated the correct value
- For formulaic objectives: Check if the student used the correct formula or substitution
- For explanation objectives: Check if the student provided the required reasoning/explanation
- Previously completed objectives are IMMUTABLE - always include them (they cannot be uncompleted)

IMPORTANT:
- Be fair but strict, like a real exam marker following the markscheme
- Only award marks (tick objectives) when clearly earned
- If the student provides a correct answer step that matches an objective, tick it off
- Previously completed objectives CANNOT be removed - always include them
- Do NOT reveal the exact wording of incomplete objectives - give hints instead
- Provide encouraging feedback about what they've achieved and what to work on next

Format your response as:
COMPLETED: [comma-separated objective indices, e.g., "0,1,3"]
HINTS: [hint 1] | [hint 2] | [hint 3]
MESSAGE: [your encouraging feedback to the student]

Use your knowledge of the subject matter to assess the answer fairly.`},
          {media: {url: userImage, contentType: 'image/png'}}
        ],
      });

      const text = response.text;
      const completedMatch = text.match(/COMPLETED:\s*\[(.*?)\]/);
      const hintsMatch = text.match(/HINTS:\s*(.*?)(?=MESSAGE:|$)/s);
      const messageMatch = text.match(/MESSAGE:\s*(.*)/s);

      const completedObjectives = completedMatch
        ? completedMatch[1].split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
        : [...previouslyCompletedObjectives];

      const hints = hintsMatch
        ? hintsMatch[1].split('|').map(s => s.trim()).filter(s => s.length > 0)
        : [];

      const nextMessage = messageMatch ? messageMatch[1].trim() : text;

      const updatedChatHistory = [...previousChatHistory];
      if (userAnswer || userImage) {
        updatedChatHistory.push({
          role: 'user',
          content: userAnswer || 'Whiteboard drawing',
          imageUrl: userImage,
        });
      }
      updatedChatHistory.push({role: 'assistant', content: nextMessage});

      return {
        nextAssistantMessage: nextMessage,
        completedObjectives,
        hints,
        chatHistory: updatedChatHistory,
      };
    }

    // Text-only path - use the original prompt
    const {
      output,
    } = await prompt({
      subsection,
      userAnswer,
      userImage,
      previousChatHistory,
      question,
      solutionObjectives,
      previouslyCompletedObjectives,
    }, {
      model: 'googleai/gemini-3-flash-preview',
    });

    if (!output) {
      throw new Error('AI response was empty.');
    }

    // Update the chat history with the user's answer and the assistant's message.
    const updatedChatHistory = [...previousChatHistory];
    if (userAnswer || userImage) {
      updatedChatHistory.push({
        role: 'user',
        content: userAnswer || 'Whiteboard drawing',
        imageUrl: userImage,
      });
    }
    updatedChatHistory.push({role: 'assistant', content: output.nextAssistantMessage});

    return {
      nextAssistantMessage: output.nextAssistantMessage,
      completedObjectives: output.completedObjectives,
      hints: output.hints,
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
      prompt: `You are Xam, a helpful AI assistant designed to generate exam-style questions for students.

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
      model: 'googleai/gemini-3-flash-preview',
    });

    if (!output) {
      throw new Error('AI response was empty.');
    }

    return {
      question: output.question,
    };
  }, input);
}
