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

// YouTube search helper using Invidious API
async function searchYouTube(query: string): Promise<{ title: string; url: string; author: string }[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:8933';
    const response = await fetch(`${baseUrl}/api/youtube-search?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error('YouTube search failed:', response.status);
      return [];
    }

    const data = await response.json();
    return data.results?.slice(0, 3) || [];
  } catch (error) {
    console.error('YouTube search error:', error);
    return [];
  }
}

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
  isNextStepRequest: z.boolean().optional().describe('Whether the user requested focused step-by-step guidance.'),
  nextIncompleteIndex: z.number().optional().describe('Index of the next incomplete objective for focused guidance.'),
  isFindRequest: z.boolean().optional().describe('Whether the user is asking for learning resources like YouTube videos or articles.'),
  youtubeResults: z.array(z.object({
    title: z.string(),
    url: z.string(),
    author: z.string(),
  })).optional().describe('YouTube video results from search.'),
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

{{#if isFindRequest}}
  SPECIAL REQUEST: The student is asking for learning resources.

  {{#if youtubeResults.length}}
  I found these YouTube videos for you! Present them in a friendly way:

  {{#each youtubeResults}}
  - "{{this.title}}" by {{this.author}} - {{this.url}}
  {{/each}}

  Format your response like:
  "I found some great videos to help you understand this topic! Click the buttons below to watch:

  **Video 1** - [brief description of why this video is helpful based on the title]
  **Video 2** - [brief description]
  **Video 3** - [brief description]

  [Then put each URL on its own line at the end - they'll become clickable buttons]"

  IMPORTANT: Include the actual URLs at the end of your message so buttons appear. Don't show raw URLs in the main text.
  {{else}}
  I couldn't find specific videos right now. Suggest the student search YouTube for topics related to: {{subsection}}
  {{/if}}

{{else if isNextStepRequest}}
  SPECIAL REQUEST: The student has clicked "Next" to get focused step-by-step guidance.

  Your task is to provide FOCUSED GUIDANCE on just the next incomplete objective:
  1. Identify the first objective that is NOT in the completed list (index {{nextIncompleteIndex}})
  2. Break this ONE objective down into small, actionable substeps
  3. Provide a clear, encouraging hint about how to approach this specific step
  4. Do NOT reveal the exact wording of the objective
  5. Do NOT mention other objectives - focus ONLY on this one step
  6. Keep the message concise and motivating

  Guide the student step-by-step through just this one objective. Be like a helpful tutor sitting next to them.

{{else if userAnswer}}

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

    // Detect if this is a [NEXT_STEP] request for focused guidance
    const isNextStepRequest = userAnswer?.startsWith('[NEXT_STEP]');
    // Detect if this is a [FIND_RESOURCES] request for web search
    const isFindRequest = userAnswer?.toLowerCase().includes('find') &&
      (userAnswer?.toLowerCase().includes('video') ||
       userAnswer?.toLowerCase().includes('resource') ||
       userAnswer?.toLowerCase().includes('article') ||
       userAnswer?.toLowerCase().includes('youtube') ||
       userAnswer?.toLowerCase().includes('tutorial'));
    const cleanUserAnswer = isNextStepRequest
      ? userAnswer.replace('[NEXT_STEP]', '').trim()
      : userAnswer;

    // If user is asking for videos, search YouTube
    let youtubeResults: { title: string; url: string; author: string }[] = [];
    if (isFindRequest) {
      // Extract topic from the subsection or question
      const searchQuery = `${subsection} tutorial explained`;
      youtubeResults = await searchYouTube(searchQuery);
    }

    // Find the next incomplete objective index
    const nextIncompleteIndex = solutionObjectives.findIndex(
      (_, idx) => !previouslyCompletedObjectives.includes(idx)
    );

    // For Genkit with images, we need to use the generate function directly
    // because definePrompt doesn't handle multimodal input properly
    if (userImage) {
      // Use direct generate call with multimodal content
      const objectivesList = solutionObjectives.map((obj, idx) => `[${idx}] ${obj}`).join('\n  ');
      const completedList = previouslyCompletedObjectives.length > 0
        ? previouslyCompletedObjectives.map(idx => `[${idx}]`).join(', ')
        : 'None yet';

      // Build the next step guidance section if needed
      const nextStepGuidance = isNextStepRequest ? `
SPECIAL REQUEST: The student has clicked "Next" to get focused step-by-step guidance.

Your task is to provide FOCUSED GUIDANCE on just the next incomplete objective (index ${nextIncompleteIndex}):
1. Break this ONE objective down into small, actionable substeps
2. Provide a clear, encouraging hint about how to approach this specific step
3. Do NOT reveal the exact wording of the objective
4. Do NOT mention other objectives - focus ONLY on this one step
5. Keep the message concise and motivating

Guide the student step-by-step through just this one objective. Be like a helpful tutor sitting next to them.
` : '';

      const response = await ai.generate({
        model: 'googleai/gemini-3-flash-preview',
        prompt: [
          {text: `You are Xam, a friendly AI teaching assistant acting as an exam marker. You are checking a student's work against the official markscheme for a real exam question, just like a teacher would do when marking exams.

${isFindRequest ? `SPECIAL REQUEST: The student is asking for learning resources.

${youtubeResults.length > 0 ? `I found these YouTube videos for you:
${youtubeResults.map((v, i) => `${i + 1}. "${v.title}" by ${v.author} - ${v.url}`).join('\n')}

Present these videos in a friendly way. Describe each video briefly based on its title.
Put each URL on its own line at the END of your message (they'll become clickable buttons).
Don't show the raw URLs in the main text - just describe the videos.` : `I couldn't find specific videos right now. Suggest the student search YouTube for: ${subsection}`}

` : ''}

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

The user has provided a whiteboard drawing (see image) ${cleanUserAnswer ? `and the following text answer: ${cleanUserAnswer}` : ''}.
${nextStepGuidance}
${!isNextStepRequest ? 'Your task is to CHECK THE STUDENT\'S WORK AGAINST THE MARKSCHEME:' : ''}

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
      userAnswer: cleanUserAnswer,
      userImage,
      previousChatHistory,
      question,
      solutionObjectives,
      previouslyCompletedObjectives,
      isNextStepRequest,
      nextIncompleteIndex,
      isFindRequest,
      youtubeResults,
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
