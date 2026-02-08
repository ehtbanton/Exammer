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

const ExtractExamQuestionsInputSchema = z.object({
  examPaperDataUri: z
    .string()
    .describe(
      "A single exam paper in PDF format, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
  markschemeDataUri: z
    .string()
    .optional()
    .describe('The corresponding markscheme file as a data URI, if available.'),
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
  solutionObjectives: z.array(z.string()).optional().describe('List of specific marking objectives/criteria from the markscheme that students must achieve to gain full marks. Empty if no markscheme provided.'),
});

const ExtractExamQuestionsOutputSchema = z.object({
  paperTypeName: z.string().describe('The name of the paper type that this exam paper belongs to, determined from the exam paper title.'),
  questions: z.array(ExamQuestionSchema).describe('A list of all discrete exam questions extracted and categorized by topic.'),
});
export type ExtractExamQuestionsOutput = z.infer<typeof ExtractExamQuestionsOutputSchema>;

export async function extractExamQuestions(
  input: ExtractExamQuestionsInput
): Promise<ExtractExamQuestionsOutput> {
  const { examPaperDataUri, markschemeDataUri, paperTypes, topics } = input;

  console.log(`[Question Extraction] Processing single exam paper${markschemeDataUri ? ' with markscheme' : ''}...`);

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
        prompt: `You are an expert educator analyzing a past exam paper to help students prepare for their exams.

Your task is to:
1. Determine which paper type this exam paper belongs to by examining the exam paper title/header
2. Extract each discrete, complete exam question (including all parts like a, b, c, etc.)
3. For each question, write a brief one-sentence summary
4. Categorize each question into the most appropriate topic from the provided list
{{#if markschemeDataUri}}
5. For each question, extract the corresponding marking criteria/objectives from the markscheme as a bullet-point list
{{/if}}

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

{{#if markschemeDataUri}}
Markscheme:
{{media url=markschemeDataUri}}
{{/if}}

Important guidelines:
- Identify the paper type from the exam paper title (e.g., "Paper 1", "Paper 2", "Advanced Paper")
- Each question should be complete and standalone
- If a question has multiple parts (a, b, c), include all parts in the questionText
- CRITICAL: Every single question MUST have all three required fields: questionText, summary, and topicName
- The summary field is REQUIRED and should be concise but informative (one sentence describing what the question asks)
- Match each question to the most relevant topic based on the topic descriptions
- If a question spans multiple topics, choose the primary/most relevant topic
- Extract ALL questions from the provided exam paper
{{#if markschemeDataUri}}
- For each question, extract the solution objectives from the markscheme
- Solution objectives should be specific, actionable criteria (e.g., "Define the term 'entropy'", "Calculate the equilibrium constant", "Explain two factors affecting reaction rate")
- If a question has multiple parts (a, b, c), extract objectives for each part
- Each objective should be a clear, measurable criterion from the markscheme
{{/if}}

OUTPUT FORMAT REQUIREMENT:
Every question object in the output array MUST contain:
1. questionText (string) - The complete question text
2. summary (string) - A one-sentence summary (REQUIRED, cannot be omitted)
3. topicName (string) - The topic this question belongs to
{{#if markschemeDataUri}}
4. solutionObjectives (array of strings) - Marking criteria from the markscheme
{{/if}}`,
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
          const questions = output?.questions ?? [];

          // Validate and fix questions missing required fields
          const validatedQuestions = questions.map((q, index) => {
            if (!q.summary || q.summary.trim() === '') {
              console.warn(`[Question Extraction] Question ${index + 1} missing summary, generating default`);
              // Generate a basic summary from the question text
              const textPreview = q.questionText?.substring(0, 100) || 'Question';
              return {
                ...q,
                summary: `Question about ${q.topicName || 'the topic'}: ${textPreview}...`
              };
            }
            return q;
          });

          return { paperTypeName, questions: validatedQuestions };
        }
      );

      return await flow({
        examPaperDataUri,
        markschemeDataUri,
        paperTypes,
        topics,
      });
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`[Question Extraction] Completed in ${duration}s - Paper Type: ${result.paperTypeName}, Extracted ${result.questions.length} questions`);

    return result;
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.error(`[Question Extraction] Error after ${duration}s:`, error);
    throw error;
  }
}
