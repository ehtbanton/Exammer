'use server';

/**
 * @fileOverview Extracts questions from a single exam paper without markscheme processing.
 *
 * This flow is part of the redesigned parallel extraction workflow where papers and
 * markschemes are processed separately and then matched mechanically.
 */

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {z} from 'genkit';
import {geminiApiKeyManager} from '@root/gemini-api-key-manager';

const PaperTypeInfoSchema = z.object({
  name: z.string().describe('The name of the paper type.'),
});

const TopicInfoSchema = z.object({
  name: z.string().describe('The name of the topic.'),
  description: z.string().describe('The description of what this topic covers.'),
});

const ExtractPaperQuestionsInputSchema = z.object({
  examPaperDataUri: z
    .string()
    .describe(
      "A single exam paper in PDF format, as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
  paperTypes: z
    .array(PaperTypeInfoSchema)
    .describe('The list of paper types from the syllabus (ordered array).'),
  topics: z
    .array(TopicInfoSchema)
    .describe('The list of topics from the syllabus to categorize questions into.'),
});
export type ExtractPaperQuestionsInput = z.infer<typeof ExtractPaperQuestionsInputSchema>;

const PaperQuestionSchema = z.object({
  questionNumber: z.number().describe('The question number from the exam paper (e.g., 1, 2, 3, 4). For multi-part questions, use the main question number only.'),
  topicName: z.string().describe('The name of the topic this question belongs to from the provided topics list.'),
  questionText: z.string().describe('The complete text of the exam question, including all parts and sub-questions.'),
  summary: z.string().describe('A brief one-sentence summary of what this question is about.'),
});

const ExtractPaperQuestionsOutputSchema = z.object({
  paperTypeIndex: z.number().describe('The 0-based index of the paper type from the provided paperTypes array (e.g., 0 for first paper type, 1 for second).'),
  paperIdentifier: z.string().describe('A unique identifier for this specific exam paper extracted from the paper content (e.g., "2022 June", "Specimen 2023", "Sample Paper 1").'),
  questions: z.array(PaperQuestionSchema).describe('All questions extracted from this exam paper.'),
});
export type ExtractPaperQuestionsOutput = z.infer<typeof ExtractPaperQuestionsOutputSchema>;

export async function extractPaperQuestions(
  input: ExtractPaperQuestionsInput
): Promise<ExtractPaperQuestionsOutput> {
  const { examPaperDataUri, paperTypes, topics } = input;

  console.log(`[Paper Extraction] Processing exam paper...`);

  const startTime = Date.now();

  try {
    const result = await geminiApiKeyManager.withKey(async (apiKey) => {
      const aiInstance = genkit({
        plugins: [googleAI({ apiKey })],
        model: 'googleai/gemini-2.5-flash-lite',
      });

      const prompt = aiInstance.definePrompt({
        name: 'extractPaperQuestionsPrompt',
        input: {schema: ExtractPaperQuestionsInputSchema},
        output: {schema: ExtractPaperQuestionsOutputSchema},
        prompt: `You are an expert educator analyzing an exam paper to extract questions and metadata.

Your task is to:
1. Determine which paper type this exam belongs to by examining the title/header
2. Extract a unique identifier for this specific paper from the content (year, session, variant)
3. Extract each discrete question with its question number
4. Categorize each question into the most appropriate topic
5. Write a brief summary for each question

Available paper types (0-indexed array):
{{#each paperTypes}}
{{@index}}. {{name}}
{{/each}}

Topics available for categorization:
{{#each topics}}
- {{name}}: {{description}}
{{/each}}

Exam Paper:
{{media url=examPaperDataUri}}

CRITICAL INSTRUCTIONS:

Paper Type Identification:
- Examine the exam paper title/header carefully
- Output the 0-based INDEX (number) of the matching paper type from the list above
- Example: If this is "Paper 1", output paperTypeIndex: 0 (if "Paper 1" is at index 0)

Paper Identifier Extraction:
- Extract the specific identifier from the paper content (NOT the filename)
- Look for year, session/month, variant, specimen/sample designation
- Examples: "2022 June", "2023 November Variant 1", "Specimen 2024", "Sample Paper"
- This should uniquely identify which specific past paper this is
- Be consistent in format (e.g., always "YYYY Month" or "Specimen YYYY")

Question Extraction:
- Extract the main question number only (1, 2, 3, 4, etc.)
- For multi-part questions (e.g., 1a, 1b, 1c), treat as a single question with number 1
- Include ALL parts (a, b, c, etc.) in the questionText
- Each question MUST have: questionNumber (integer), topicName, questionText, summary
- Extract ALL questions from the paper

Topic Categorization:
- Match each question to the most relevant topic based on descriptions
- If a question spans multiple topics, choose the primary one
- Use exact topic names from the provided list

Summary Requirements:
- Write a concise one-sentence summary for each question
- Focus on what the question asks, not how to solve it
- Must be informative and specific to the question content`,
      });

      const flow = aiInstance.defineFlow(
        {
          name: 'extractPaperQuestionsFlow',
          inputSchema: ExtractPaperQuestionsInputSchema,
          outputSchema: ExtractPaperQuestionsOutputSchema,
        },
        async input => {
          const response = await prompt(input);
          const output = response.output;

          if (!output) {
            throw new Error('No output received from AI model');
          }

          // Validate required fields
          const paperTypeIndex = output.paperTypeIndex ?? -1;
          const paperIdentifier = output.paperIdentifier || 'Unknown';
          const questions = output.questions || [];

          if (paperTypeIndex < 0 || paperTypeIndex >= paperTypes.length) {
            console.warn(`[Paper Extraction] Invalid paperTypeIndex: ${paperTypeIndex}, defaulting to 0`);
          }

          // Validate each question
          const validatedQuestions = questions.map((q, index) => {
            if (!q.summary || q.summary.trim() === '') {
              console.warn(`[Paper Extraction] Question ${q.questionNumber} missing summary, generating default`);
              const textPreview = q.questionText?.substring(0, 100) || 'Question';
              return {
                ...q,
                summary: `Question about ${q.topicName || 'the topic'}: ${textPreview}...`
              };
            }
            if (typeof q.questionNumber !== 'number') {
              console.warn(`[Paper Extraction] Question at index ${index} has invalid questionNumber, using index`);
              return {
                ...q,
                questionNumber: index + 1
              };
            }
            return q;
          });

          return {
            paperTypeIndex: Math.max(0, Math.min(paperTypeIndex, paperTypes.length - 1)),
            paperIdentifier,
            questions: validatedQuestions
          };
        }
      );

      return await flow({
        examPaperDataUri,
        paperTypes,
        topics,
      });
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`[Paper Extraction] Completed in ${duration}s - Paper: ${result.paperIdentifier}, Type Index: ${result.paperTypeIndex}, Questions: ${result.questions.length}`);

    return result;
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.error(`[Paper Extraction] Error after ${duration}s:`, error);
    throw error;
  }
}
