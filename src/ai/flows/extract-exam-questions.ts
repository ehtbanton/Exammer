'use server';

/**
 * @fileOverview Extracts and categorizes exam questions from uploaded past papers into topics.
 *
 * - extractExamQuestions - A function that extracts discrete exam questions and sorts them into topics.
 * - ExtractExamQuestionsInput - The input type for the extractExamQuestions function.
 * - ExtractExamQuestionsOutput - The return type for the extractExamQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TopicInfoSchema = z.object({
  name: z.string().describe('The name of the topic.'),
  description: z.string().describe('The description of what this topic covers.'),
});

const ExtractExamQuestionsInputSchema = z.object({
  examPapersDataUris: z
    .array(z.string())
    .describe(
      "An array of exam papers in PDF format, as data URIs that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
  topics: z
    .array(TopicInfoSchema)
    .describe('The list of topics from the syllabus to categorize questions into.'),
});
export type ExtractExamQuestionsInput = z.infer<typeof ExtractExamQuestionsInputSchema>;

const ExamQuestionSchema = z.object({
  questionText: z.string().describe('The complete text of the exam question, including all parts and sub-questions.'),
  summary: z.string().describe('A brief one-sentence summary of what this question is about.'),
  topicName: z.string().describe('The name of the topic this question belongs to.'),
});

const ExtractExamQuestionsOutputSchema = z.object({
  questions: z.array(ExamQuestionSchema).describe('A list of all discrete exam questions extracted and categorized by topic.'),
});
export type ExtractExamQuestionsOutput = z.infer<typeof ExtractExamQuestionsOutputSchema>;

export async function extractExamQuestions(
  input: ExtractExamQuestionsInput
): Promise<ExtractExamQuestionsOutput> {
  return extractExamQuestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractExamQuestionsPrompt',
  input: {schema: ExtractExamQuestionsInputSchema},
  output: {schema: ExtractExamQuestionsOutputSchema},
  prompt: `You are an expert educator analyzing past exam papers to help students prepare for their exams.

Your task is to:
1. Read through all the provided exam papers
2. Extract each discrete, complete exam question (including all parts like a, b, c, etc.)
3. For each question, write a brief one-sentence summary
4. Categorize each question into the most appropriate topic from the provided list

Topics available for categorization:
{{#each topics}}
- {{name}}: {{description}}
{{/each}}

Exam Papers:
{{#each examPapersDataUris}}
{{media url=this}}
{{/each}}

Important guidelines:
- Each question should be complete and standalone
- If a question has multiple parts (a, b, c), include all parts in the questionText
- The summary should be concise but informative (one sentence)
- Match each question to the most relevant topic based on the topic descriptions
- If a question spans multiple topics, choose the primary/most relevant topic
- Extract ALL questions from ALL papers provided`,
});

const extractExamQuestionsFlow = ai.defineFlow(
  {
    name: 'extractExamQuestionsFlow',
    inputSchema: ExtractExamQuestionsInputSchema,
    outputSchema: ExtractExamQuestionsOutputSchema,
  },
  async input => {
    const response = await prompt(input);
    const output = response.output;

    // Ensure that the output always has required fields.
    const questions = output?.questions ?? [];
    return { questions };
  }
);
