'use server';

/**
 * @fileOverview Extracts and categorizes exam questions from a single exam paper.
 *
 * - extractExamQuestions - A function that determines the paper type from the exam title and extracts discrete exam questions, sorting them into topics.
 * - ExtractExamQuestionsInput - The input type for the extractExamQuestions function.
 * - ExtractExamQuestionsOutput - The return type for the extractExamQuestions function, including the determined paper type name.
 */

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {z} from 'genkit';
import {geminiApiKeyManager} from '@root/gemini-api-key-manager';

const TopicInfoSchema = z.object({
  name: z.string().describe('The name of the topic.'),
  description: z.string().describe('The description of what this topic covers.'),
});

const PaperTypeInfoSchema = z.object({
  name: z.string().describe('The name of the paper type.'),
});

const MarkschemeDataSchema = z.object({
  name: z.string().describe('The filename of the markscheme.'),
  dataUri: z.string().describe('The markscheme file as a data URI.'),
});

const ExtractExamQuestionsInputSchema = z.object({
  examPaperDataUri: z
    .string()
    .describe(
      "A single exam paper in PDF format, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
  markschemes: z
    .array(MarkschemeDataSchema)
    .describe('All available markscheme files with their names and data URIs.'),
  paperTypes: z
    .array(PaperTypeInfoSchema)
    .describe('The list of paper types from the syllabus that this exam paper could belong to.'),
  topics: z
    .array(TopicInfoSchema)
    .describe('The list of topics from the syllabus to categorize questions into.'),
});
export type ExtractExamQuestionsInput = z.infer<typeof ExtractExamQuestionsInputSchema>;

const ExamQuestionSchema = z.object({
  questionText: z.string().describe('The complete text of the exam question, including all parts and sub-questions.'),
  summary: z.string().describe('A brief one-sentence summary of what this question is about.'),
  topicName: z.string().describe('The name of the topic this question belongs to.'),
  solutionObjectives: z.array(z.string()).describe('List of specific marking objectives/criteria from the markscheme that students must achieve to gain full marks.'),
});

const ExtractExamQuestionsOutputSchema = z.object({
  paperTypeName: z.string().describe('The name of the paper type that this exam paper belongs to, determined from the exam paper title.'),
  matchedMarkschemeName: z.string().nullable().describe('The name of the markscheme file that was matched to this paper, or null if no match found.'),
  questions: z.array(ExamQuestionSchema).describe('A list of all discrete exam questions extracted with their solution objectives from the markscheme.'),
});
export type ExtractExamQuestionsOutput = z.infer<typeof ExtractExamQuestionsOutputSchema>;

export async function extractExamQuestions(
  input: ExtractExamQuestionsInput
): Promise<ExtractExamQuestionsOutput> {
  const { examPaperDataUri, markschemes, paperTypes, topics } = input;

  console.log(`[Question Extraction] Processing single exam paper with ${markschemes.length} available markschemes...`);

  const startTime = Date.now();

  try {
    // Use the global API key manager to execute with a managed key
    const result = await geminiApiKeyManager.withKey(async (apiKey) => {
      // Create a genkit instance with this specific API key
      const aiInstance = genkit({
        plugins: [googleAI({ apiKey })],
        model: 'googleai/gemini-2.5-flash-lite',
      });

      // Create flow with this AI instance
      const prompt = aiInstance.definePrompt({
        name: 'extractExamQuestionsPrompt',
        input: {schema: ExtractExamQuestionsInputSchema},
        output: {schema: ExtractExamQuestionsOutputSchema},
        prompt: `You are an expert educator analyzing a past exam paper and its markscheme to help students prepare for their exams.

Your task is to:
1. Determine which paper type this exam paper belongs to by examining the exam paper title/header
2. Match this exam paper to the correct markscheme from the available markschemes by analyzing filenames and content
3. If NO matching markscheme is found, return null for matchedMarkschemeName and an empty questions array
4. If a markscheme IS found:
   - Extract each discrete, complete exam question (including all parts like a, b, c, etc.)
   - For each question, write a brief one-sentence summary
   - Categorize each question into the most appropriate topic from the provided list
   - Extract the solution objectives/marking criteria from the markscheme for each question

Available paper types:
{{#each paperTypes}}
- {{name}}
{{/each}}

Topics available for categorization:
{{#each topics}}
- {{name}}: {{description}}
{{/each}}

Exam Paper:
{{media url=examPaperDataUri}}

Available Markschemes:
{{#each markschemes}}
- Filename: {{name}}
  Content: {{media url=dataUri}}
{{/each}}

Important guidelines:
- First, identify the paper type from the exam paper title (e.g., "Paper 1", "Paper 2", "Advanced Paper")
- Match the paper to its markscheme by comparing filenames, paper identifiers, dates, etc.
- If no markscheme matches, set matchedMarkschemeName to null and return empty questions array
- If a markscheme is found, extract ALL questions from the exam paper
- For each question, identify the corresponding marking criteria/objectives from the markscheme
- Solution objectives should be specific, actionable criteria (e.g., "Define the term 'entropy'", "Calculate the equilibrium constant", "Explain two factors affecting reaction rate")
- Each question should be complete and standalone
- If a question has multiple parts (a, b, c), include all parts in the questionText and extract objectives for each part
- The summary should be concise but informative (one sentence)
- Match each question to the most relevant topic based on the topic descriptions`,
      });

      const flow = aiInstance.defineFlow(
        {
          name: 'extractExamQuestionsFlow',
          inputSchema: ExtractExamQuestionsInputSchema,
          outputSchema: ExtractExamQuestionsOutputSchema,
        },
        async input => {
          const response = await prompt(input);
          const output = response.output;
          const paperTypeName = output?.paperTypeName ?? 'Unknown';
          const matchedMarkschemeName = output?.matchedMarkschemeName ?? null;
          const questions = output?.questions ?? [];
          return { paperTypeName, matchedMarkschemeName, questions };
        }
      );

      return await flow({
        examPaperDataUri,
        markschemes,
        paperTypes,
        topics,
      });
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    if (result.matchedMarkschemeName) {
      console.log(`[Question Extraction] Completed in ${duration}s - Paper Type: ${result.paperTypeName}, Matched Markscheme: ${result.matchedMarkschemeName}, Extracted ${result.questions.length} questions`);
    } else {
      console.log(`[Question Extraction] Completed in ${duration}s - Paper Type: ${result.paperTypeName}, NO MARKSCHEME FOUND - Skipped`);
    }

    return result;
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.error(`[Question Extraction] Error after ${duration}s:`, error);
    throw error;
  }
}
