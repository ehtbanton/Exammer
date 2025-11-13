'use server';

/**
 * @fileOverview Extracts questions from a single exam paper with index-based categorization.
 *
 * This flow uses content analysis to determine the paper type and categorize questions
 * by topic. Instead of string matching, the AI analyzes question content against topic
 * descriptions and returns indices, eliminating fuzzy matching failures.
 */

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {z} from 'genkit';
import {geminiApiKeyManager} from '@root/gemini-api-key-manager';

const PaperTypeInfoSchema = z.object({
  index: z.number().describe('The 0-based index of this paper type in the provided array.'),
  name: z.string().describe('The name of the paper type.'),
  topics: z.array(z.object({
    index: z.number().describe('The 0-based index of this topic in the global topics array.'),
    name: z.string().describe('The name of the topic.'),
    description: z.string().describe('The description of what this topic covers.'),
  })).describe('Topics covered in this paper type.'),
});

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
  paperTypes: z
    .array(PaperTypeInfoSchema)
    .describe('The list of paper types from the syllabus (ordered array with indices).'),
  topics: z
    .array(TopicInfoSchema)
    .describe('The list of all topics from the syllabus (ordered array with indices).'),
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
  paperTypeIndex: z.number().describe('The 0-based index of the paper type (from the paperTypes array) determined by analyzing which topics best match ALL questions in the paper.'),
  paperTypeConfidence: z.number().min(0).max(100).describe('Your confidence score (0-100) that you correctly identified the paper type. Use 100 for obvious matches, 70-90 for good matches, 50-70 for uncertain matches, below 50 for very uncertain matches.'),
  paperTypeReasoning: z.string().describe('A brief 1-2 sentence explanation of why you chose this paper type based on analyzing all questions in the paper.'),
  year: z.number().describe('The year from the exam paper (4 digits, e.g., 2022).'),
  month: z.number().describe('The month from the exam paper (1-12, e.g., 6 for June).'),
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
        prompt: `TASK: Extract questions from exam paper using CONTENT-BASED ANALYSIS (not header matching).

PAPER TYPES (WITH INDICES AND TOPICS):
{{#each paperTypes}}
[Paper Type {{index}}] {{name}}
  Topics:
  {{#each topics}}
  - [Topic {{index}}] {{name}}: {{description}}
  {{/each}}

{{/each}}

ALL TOPICS (FOR REFERENCE):
{{#each topics}}
[{{index}}] {{name}}: {{description}}
{{/each}}

DOCUMENT:
{{media url=examPaperDataUri}}

CRITICAL INSTRUCTIONS - READ CAREFULLY:

1. PAPER TYPE DETERMINATION (CONTENT-BASED, NOT HEADER-BASED)

   DO NOT rely on paper header text like "Paper 1", "Paper 2", etc.
   Instead, follow this procedure:

   a) First, extract ALL questions from the document
   b) For EACH question, identify which topics it relates to (based on content)
   c) Count which paper type has the MOST topic matches
   d) Return the INDEX (0-based) of that paper type
   e) Provide a confidence score (0-100):
      - 100: All questions clearly match one paper type
      - 70-90: Most questions match, some ambiguous
      - 50-70: Moderate uncertainty, questions could fit multiple paper types
      - <50: Very uncertain, questions don't clearly match any paper type
   f) Explain your reasoning in 1-2 sentences

   Example: If most questions relate to topics under Paper Type 0, return paperTypeIndex: 0

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

5. YEAR AND MONTH EXTRACTION

   - Locate the exam date in the document (usually at the top)
   - Extract year as 4-digit number (e.g., 2022)
   - Extract month as number 1-12 (e.g., 6 for June)

OUTPUT STRUCTURE:
{
  "paperTypeIndex": <0-based index>,
  "paperTypeConfidence": <0-100>,
  "paperTypeReasoning": "<1-2 sentence explanation>",
  "year": <4-digit year>,
  "month": <1-12>,
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
- Paper type index is within valid range (0 to {{paperTypes.length}} - 1)
- All topic indices are within valid range (0 to {{topics.length}} - 1)
- Question numbers are sequential without gaps (1, 2, 3, 4...)
- Total question count is within expected range (typically 5-15 questions)
- Each question has substantial content (not just a number)
- Multi-part questions (1a, 1b, 1c) are combined under a single main number
- All confidence scores are between 0 and 100
- Categorization reasoning explains the content match, not just restates the topic name

REMEMBER: Use CONTENT ANALYSIS, not string matching or header text matching!`,
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

              // Validate paper type index
              const paperTypeIndex = output.paperTypeIndex ?? -1;
              if (paperTypeIndex < 0 || paperTypeIndex >= paperTypes.length) {
                lastError = `Invalid paper type index: ${paperTypeIndex}. Must be between 0 and ${paperTypes.length - 1}.`;
                console.warn(`[Paper Extraction] Attempt ${attempt}/${MAX_RETRIES} - ${lastError}`);

                if (attempt < MAX_RETRIES) {
                  console.log(`[Paper Extraction] Retrying with paper type validation...`);
                  continue;
                }

                throw new Error(`Paper type determination failed after ${MAX_RETRIES} attempts. ${lastError}`);
              }

              // Validate paper type confidence
              const paperTypeConfidence = output.paperTypeConfidence ?? 0;
              if (paperTypeConfidence < 0 || paperTypeConfidence > 100) {
                lastError = `Invalid paper type confidence: ${paperTypeConfidence}. Must be between 0 and 100.`;
                console.warn(`[Paper Extraction] Attempt ${attempt}/${MAX_RETRIES} - ${lastError}`);

                if (attempt < MAX_RETRIES) {
                  console.log(`[Paper Extraction] Retrying with confidence validation...`);
                  continue;
                }

                throw new Error(`Paper type confidence validation failed after ${MAX_RETRIES} attempts. ${lastError}`);
              }

              // Validate year
              const year = output.year ?? 0;
              if (year < 1900 || year > 2100) {
                lastError = `Invalid year: ${year}. Must be between 1900 and 2100.`;
                console.warn(`[Paper Extraction] Attempt ${attempt}/${MAX_RETRIES} - ${lastError}`);

                if (attempt < MAX_RETRIES) {
                  console.log(`[Paper Extraction] Retrying with year correction...`);
                  continue;
                }

                throw new Error(`Year validation failed after ${MAX_RETRIES} attempts. ${lastError}`);
              }

              // Validate month
              const month = output.month ?? 0;
              if (month < 1 || month > 12) {
                lastError = `Invalid month: ${month}. Must be between 1 and 12.`;
                console.warn(`[Paper Extraction] Attempt ${attempt}/${MAX_RETRIES} - ${lastError}`);

                if (attempt < MAX_RETRIES) {
                  console.log(`[Paper Extraction] Retrying with month correction...`);
                  continue;
                }

                throw new Error(`Month validation failed after ${MAX_RETRIES} attempts. ${lastError}`);
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
                paperTypeIndex,
                paperTypeConfidence,
                paperTypeReasoning: output.paperTypeReasoning || 'No reasoning provided',
                year,
                month,
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
        paperTypes,
        topics,
      });
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    const monthPadded = result.month.toString().padStart(2, '0');
    const paperTypeName = paperTypes[result.paperTypeIndex]?.name || `Type ${result.paperTypeIndex}`;
    console.log(`[Paper Extraction] Completed in ${duration}s - Paper: ${result.year}-${monthPadded} "${paperTypeName}" (confidence: ${result.paperTypeConfidence}%), Questions: ${result.questions.length}`);

    // Log low confidence warnings
    if (result.paperTypeConfidence < 70) {
      console.warn(`[Paper Extraction] ⚠ Low paper type confidence (${result.paperTypeConfidence}%): ${result.paperTypeReasoning}`);
    }

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
