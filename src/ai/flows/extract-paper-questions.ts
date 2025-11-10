'use server';

/**
 * @fileOverview Extracts questions from a single exam paper with index-based topic categorization.
 *
 * This flow extracts the date from the filename and categorizes questions by topic using
 * content analysis. The AI analyzes question content against topic descriptions and returns
 * indices, eliminating fuzzy matching failures.
 */

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {z} from 'genkit';
import {geminiApiKeyManager} from '@root/gemini-api-key-manager';

const TopicInfoSchema = z.object({
  index: z.number().describe('The 0-based index of this topic in the provided array.'),
  name: z.string().describe('The name of the topic.'),
  description: z.string().describe('The description of what this topic covers.'),
});

const ExtractPaperQuestionsInputSchema = z.object({
  examPaperDataUri: z
    .string()
    .describe(
      "A single exam paper in PDF format, as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
  filename: z
    .string()
    .describe('The filename of the exam paper, used for extracting the paper date.'),
  topics: z
    .array(TopicInfoSchema)
    .describe('The list of all topics from the current paper type (ordered array with indices).'),
});
export type ExtractPaperQuestionsInput = z.infer<typeof ExtractPaperQuestionsInputSchema>;

const PaperQuestionSchema = z.object({
  questionNumber: z.number().describe('The question number from the exam paper (e.g., 1, 2, 3). For multi-part questions, use only the main number.'),
  questionText: z.string().describe('The complete text of the exam question, including all parts and sub-questions.'),
  summary: z.string().describe('A brief one-sentence summary of what this question is about.'),
  topicIndex: z.number().describe('The 0-based index of the topic this question belongs to (from the topics array). Choose based on content analysis, not header text.'),
  categorizationConfidence: z.number().min(0).max(100).describe('Your confidence score (0-100) that this question belongs to the chosen topic. Use 100 for obvious matches, 70-90 for good matches, 50-70 for uncertain matches, below 50 for very uncertain matches.'),
  categorizationReasoning: z.string().describe('A brief 1-2 sentence explanation of why you chose this topic for this question based on the question content and topic description.'),
  diagramMermaid: z.string().optional().describe('If this question includes a diagram, graph, figure, or visual element, provide mermaid diagram syntax to represent it. Use appropriate mermaid diagram types (graph, flowchart, sequenceDiagram, etc.). Include all measurements, labels, and relationships from the original. Omit if question is text-only.'),
});

const ExtractPaperQuestionsOutputSchema = z.object({
  year: z.number().nullable().describe('The year from the filename (4 digits, e.g., 2024). Extract from filename using patterns like "2024", "2024-06", "2024-06-15". Required - if not found, use null.'),
  month: z.number().nullable().describe('The month from the filename (1-12, e.g., 6). Extract from filename using patterns like "2024-06", "06-2024", "June-2024", etc. Optional - use null if not found.'),
  day: z.number().nullable().describe('The day from the filename (1-31, e.g., 15). Extract from filename using patterns like "2024-06-15". Optional - use null if not found.'),
  questions: z.array(PaperQuestionSchema).describe('All questions extracted from this exam paper.'),
});
export type ExtractPaperQuestionsOutput = z.infer<typeof ExtractPaperQuestionsOutputSchema>;

export async function extractPaperQuestions(
  input: ExtractPaperQuestionsInput
): Promise<ExtractPaperQuestionsOutput> {
  const { examPaperDataUri, filename, topics } = input;

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
        prompt: `TASK: Extract questions from exam paper and categorize them into topics.

FILENAME: {{filename}}

TOPICS:
{{#each topics}}
[{{index}}] {{name}}: {{description}}
{{/each}}

DOCUMENT:
{{media url=examPaperDataUri}}

CRITICAL INSTRUCTIONS - READ CAREFULLY:

1. DATE EXTRACTION FROM FILENAME

   Extract the date from the filename "{{filename}}":

   a) Look for year patterns (required):
      - 4-digit year: "2024", "2023", etc.
      - Must be present in filename
      - If not found, set year to null

   b) Look for month patterns (optional):
      - Numeric: "06", "6", "12", etc. (1-12)
      - ISO format: "2024-06", "2024-06-15"
      - Month names: "June", "Jun", "June-2024", "2024-June"
      - If not found, set month to null

   c) Look for day patterns (optional):
      - Numeric: "15", "01", etc. (1-31)
      - ISO format: "2024-06-15"
      - If not found, set day to null

   Example extractions:
   - "2024-06-15-physics.pdf" → year: 2024, month: 6, day: 15
   - "physics-2024-06.pdf" → year: 2024, month: 6, day: null
   - "June-2024-exam.pdf" → year: 2024, month: 6, day: null
   - "2024-physics.pdf" → year: 2024, month: null, day: null

2. TOPIC CATEGORIZATION (CONTENT-BASED MATCHING)

   For EACH question:

   a) Read the complete question text carefully
   b) Compare the question content against ALL topic descriptions
   c) Identify which topic's description BEST matches the question content
   d) Return the INDEX (0-based) of that topic from the topics array
   e) Provide a confidence score (0-100):
      - 100: Question content perfectly matches topic description
      - 70-90: Good match, clear alignment with topic
      - 50-70: Moderate match, some ambiguity
      - <50: Uncertain, question could fit multiple topics
   f) Explain your reasoning in 1-2 sentences (why this topic based on content)

   IMPORTANT:
   - DO NOT use fuzzy string matching or name similarity
   - DO NOT guess based on question wording alone
   - ALWAYS refer back to the topic description
   - If a question spans multiple topics, choose the PRIMARY topic

3. QUESTION NUMBER IDENTIFICATION

   To correctly identify question numbers in the document, follow this protocol:

   a) Locate question markers in the document:
      - Standard formats: "Question 1", "Question 2", "Q1", "Q2", "Q.1", "Q.2"
      - Numeric formats: "1.", "2)", "3." at the start of content blocks
      - Visual emphasis: Numbers in bold or larger font preceding question content

   b) Distinguish question numbers from other numeric elements:
      - Page numbers (typically in headers, footers, or page corners) are NOT question numbers
      - Section headers ("Section A", "Part I", "Part II") are NOT question numbers
      - Mark allocations ("[3 marks]", "(5 marks)", "[Total: 20]") are NOT question numbers
      - Years and dates ("2023", "June 2022") are NOT question numbers

   c) Handle multi-part questions:
      - Treat "1a", "1(a)", "1 (a)", "1(i)", "1 i" as sub-parts of Question 1
      - Combine all sub-parts into a single question using the main number only
      - Extract the complete text including all sub-parts

   d) Validate sequential numbering:
      - Questions should be numbered consecutively: 1, 2, 3, 4, 5, etc.
      - Typical exam papers contain 5-15 questions
      - If numbering contains gaps or appears incorrect, re-examine the document

4. FOR EACH QUESTION OUTPUT:
   - questionNumber: Just the number (e.g., 1, 2, 3)
   - questionText: Complete text including all sub-parts
   - summary: Single sentence description
   - topicIndex: The 0-based index from the topics array (based on content analysis)
   - categorizationConfidence: 0-100 score for topic match confidence
   - categorizationReasoning: 1-2 sentences explaining why you chose this topic
   - diagramMermaid (OPTIONAL): If the question includes a diagram, graph, chart, figure, or any visual element:
     * Provide valid mermaid diagram syntax to represent the visual element
     * Use appropriate mermaid types: graph/flowchart (for general diagrams), sequenceDiagram (for sequences), classDiagram (for relationships), etc.
     * Include all measurements, labels, and relationships from the original diagram
     * Include specific values, angles, dimensions shown in the diagram
     * Example for a triangle: "graph TD\\n    A[\\"Point A\\"] ---|[\\"3 cm\\"]| B[\\"Point B\\"]\\n    B ---|[\\"4 cm\\"]| C[\\"Point C\\"]\\n    C ---|[\\"5 cm\\"]| A"
     * If question is text-only with no visual elements, OMIT this field entirely

OUTPUT STRUCTURE:
{
  "year": <4-digit year or null>,
  "month": <1-12 or null>,
  "day": <1-31 or null>,
  "questions": [
    {
      "questionNumber": <integer>,
      "questionText": "<complete text>",
      "summary": "<single sentence>",
      "topicIndex": <0-based index from topics array>,
      "categorizationConfidence": <0-100>,
      "categorizationReasoning": "<1-2 sentence explanation>",
      "diagramMermaid": "<optional: mermaid syntax if visual element present>"
    }
  ]
}

VALIDATION REQUIREMENTS:

Before generating output, verify the following:
- Year must be extracted from filename (null if not found)
- Month must be 1-12 or null
- Day must be 1-31 or null
- All topic indices are within valid range (0 to {{topics.length}} - 1)
- Question numbers are sequential without gaps (1, 2, 3, 4...)
- Total question count is within expected range (typically 5-15 questions)
- Each question has substantial content (not just a number)
- Multi-part questions (1a, 1b, 1c) are combined under a single main number
- All confidence scores are between 0 and 100
- Categorization reasoning explains the content match, not just restates the topic name

REMEMBER: Use CONTENT ANALYSIS for topic categorization, and extract dates from the FILENAME!`,
      });

      const flow = aiInstance.defineFlow(
        {
          name: 'extractPaperQuestionsFlow',
          inputSchema: ExtractPaperQuestionsInputSchema,
          outputSchema: ExtractPaperQuestionsOutputSchema,
        },
        async input => {
          const MAX_RETRIES = 3;
          let lastError: string = '';

          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
              const response = await prompt(input);
              const output = response.output;

              if (!output) {
                throw new Error('No output received from AI model');
              }

              // Validate year (nullable)
              const year = output.year ?? null;
              if (year !== null && (year < 1900 || year > 2100)) {
                lastError = `Invalid year: ${year}. Must be between 1900 and 2100 or null.`;
                console.warn(`[Paper Extraction] Attempt ${attempt}/${MAX_RETRIES} - ${lastError}`);

                if (attempt < MAX_RETRIES) {
                  console.log(`[Paper Extraction] Retrying with year correction...`);
                  continue;
                }

                throw new Error(`Year validation failed after ${MAX_RETRIES} attempts. ${lastError}`);
              }

              // Validate month (nullable)
              const month = output.month ?? null;
              if (month !== null && (month < 1 || month > 12)) {
                lastError = `Invalid month: ${month}. Must be between 1 and 12 or null.`;
                console.warn(`[Paper Extraction] Attempt ${attempt}/${MAX_RETRIES} - ${lastError}`);

                if (attempt < MAX_RETRIES) {
                  console.log(`[Paper Extraction] Retrying with month correction...`);
                  continue;
                }

                throw new Error(`Month validation failed after ${MAX_RETRIES} attempts. ${lastError}`);
              }

              // Validate day (nullable)
              const day = output.day ?? null;
              if (day !== null && (day < 1 || day > 31)) {
                lastError = `Invalid day: ${day}. Must be between 1 and 31 or null.`;
                console.warn(`[Paper Extraction] Attempt ${attempt}/${MAX_RETRIES} - ${lastError}`);

                if (attempt < MAX_RETRIES) {
                  console.log(`[Paper Extraction] Retrying with day correction...`);
                  continue;
                }

                throw new Error(`Day validation failed after ${MAX_RETRIES} attempts. ${lastError}`);
              }

              // Warn if year is null
              if (year === null) {
                console.warn(`[Paper Extraction] Year not found in filename: ${filename}`);
              }

              // Validate questions array
              const questions = output.questions || [];
              if (questions.length === 0) {
                lastError = 'No questions extracted from paper.';
                console.warn(`[Paper Extraction] Attempt ${attempt}/${MAX_RETRIES} - ${lastError}`);

                if (attempt < MAX_RETRIES) {
                  console.log(`[Paper Extraction] Retrying question extraction...`);
                  continue;
                }

                throw new Error(`Question extraction failed after ${MAX_RETRIES} attempts. ${lastError}`);
              }

              // Validate each question structure
              const validatedQuestions = questions.map((q, index) => {
                // Validate summary
                if (!q.summary || q.summary.trim() === '') {
                  console.warn(`[Paper Extraction] Question ${q.questionNumber || index + 1} missing summary, generating default`);
                  const textPreview = q.questionText?.substring(0, 100) || 'Question';
                  q.summary = `Question text: ${textPreview}...`;
                }

                // Validate question number
                if (typeof q.questionNumber !== 'number' || q.questionNumber < 1) {
                  console.warn(`[Paper Extraction] Question at index ${index} has invalid questionNumber, using fallback`);
                  q.questionNumber = index + 1;
                }

                // Validate topic index
                if (typeof q.topicIndex !== 'number' || q.topicIndex < 0 || q.topicIndex >= topics.length) {
                  console.warn(`[Paper Extraction] Question ${q.questionNumber} has invalid topicIndex ${q.topicIndex}, must be 0-${topics.length - 1}`);
                  // Set to 0 as fallback with low confidence
                  q.topicIndex = 0;
                  q.categorizationConfidence = 30;
                  q.categorizationReasoning = 'Fallback categorization due to invalid topic index';
                }

                // Validate confidence score
                if (typeof q.categorizationConfidence !== 'number' || q.categorizationConfidence < 0 || q.categorizationConfidence > 100) {
                  console.warn(`[Paper Extraction] Question ${q.questionNumber} has invalid confidence ${q.categorizationConfidence}, using default 50`);
                  q.categorizationConfidence = 50;
                }

                // Validate reasoning
                if (!q.categorizationReasoning || q.categorizationReasoning.trim() === '') {
                  console.warn(`[Paper Extraction] Question ${q.questionNumber} missing categorization reasoning`);
                  q.categorizationReasoning = 'No reasoning provided';
                }

                return q;
              });

              console.log(`[Paper Extraction] ✓ Validation passed on attempt ${attempt}`);

              return {
                year,
                month,
                day,
                questions: validatedQuestions
              };

            } catch (error: any) {
              if (attempt === MAX_RETRIES) {
                throw error;
              }
              console.warn(`[Paper Extraction] Attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`);
            }
          }

          throw new Error(`Extraction failed after ${MAX_RETRIES} attempts. Last error: ${lastError}`);
        }
      );

      return await flow({
        examPaperDataUri,
        filename,
        topics,
      });
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Format date string for logging
    let dateStr = 'No date';
    if (result.year !== null) {
      dateStr = result.year.toString();
      if (result.month !== null) {
        const monthPadded = result.month.toString().padStart(2, '0');
        dateStr += `-${monthPadded}`;
        if (result.day !== null) {
          const dayPadded = result.day.toString().padStart(2, '0');
          dateStr += `-${dayPadded}`;
        }
      }
    }

    console.log(`[Paper Extraction] Completed in ${duration}s - File: "${filename}", Date: ${dateStr}, Questions: ${result.questions.length}`);

    const lowConfidenceQuestions = result.questions.filter(q => q.categorizationConfidence < 70);
    if (lowConfidenceQuestions.length > 0) {
      console.warn(`[Paper Extraction] ⚠ ${lowConfidenceQuestions.length} question(s) with low categorization confidence (<70%)`);
    }

    return result;
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.error(`[Paper Extraction] Error after ${duration}s:`, error);
    throw error;
  }
}
