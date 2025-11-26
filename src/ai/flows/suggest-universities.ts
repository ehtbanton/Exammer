'use server';

/**
 * @fileOverview Suggests universities and courses based on brainstorming results or direct input.
 *
 * - suggestUniversities - Generates university and course recommendations
 * - SuggestUniversitiesInput - The input type for the suggestUniversities function
 * - SuggestUniversitiesOutput - The return type for the suggestUniversities function
 */

import { z } from 'genkit';
import { executeWithManagedKey } from '@/ai/genkit';

const UniversitySuggestionSchema = z.object({
  universityName: z.string().describe('Full name of the university'),
  courseName: z.string().describe('Specific undergraduate course/degree name'),
  reasoning: z.string().describe('Why this university/course matches the student\'s interests (1-2 sentences)'),
  typicalOffer: z.string().describe('Typical A-level grade requirements (e.g., "AAA", "A*AA")'),
  keySubjects: z.array(z.string()).describe('Required or recommended A-level subjects'),
});

const SuggestUniversitiesInputSchema = z.object({
  brainstormInterests: z.array(z.string()).optional().describe('List of academic interests from brainstorming session'),
  directInput: z.string().optional().describe('Direct course/career interest provided by student'),
  userInterests: z.string().optional().describe('User\'s academic interests and activities they enjoy'),
  currentYearGroup: z.string().optional().describe('Current year group (e.g., "Year 12")'),
  cvData: z.object({
    skills: z.array(z.string()).optional(),
    achievements: z.array(z.string()).optional(),
    workExperience: z.array(z.string()).optional(),
  }).optional().describe('Parsed CV data if available'),
});
export type SuggestUniversitiesInput = z.infer<typeof SuggestUniversitiesInputSchema>;

const SuggestUniversitiesOutputSchema = z.object({
  suggestions: z.array(UniversitySuggestionSchema).describe('5 university and course recommendations'),
});
export type SuggestUniversitiesOutput = z.infer<typeof SuggestUniversitiesOutputSchema>;

/**
 * Suggests universities and courses based on student interests and background
 */
export async function suggestUniversities(
  input: SuggestUniversitiesInput
): Promise<SuggestUniversitiesOutput> {
  return await executeWithManagedKey(
    async (ai, flowInput) => {
      const suggestPrompt = ai.definePrompt({
        name: 'suggestUniversities',
        input: {
          schema: SuggestUniversitiesInputSchema,
        },
        output: {
          schema: SuggestUniversitiesOutputSchema,
        },
        prompt: `You are a UCAS university admissions expert helping UK students find suitable universities and courses.

Your task is to suggest **exactly 5** university and undergraduate course combinations that match the student's interests and background.

**Student Information:**

{{#if brainstormInterests}}
**Brainstormed Interests:** {{#each brainstormInterests}}{{this}}, {{/each}}
{{/if}}

{{#if directInput}}
**Direct Interest:** {{directInput}}
{{/if}}

{{#if userInterests}}
**User Interests:** {{userInterests}}
{{/if}}

{{#if currentYearGroup}}
**Current Year:** {{currentYearGroup}}
{{/if}}

{{#if cvData}}
**CV Data:**
{{#if cvData.skills}}Skills: {{#each cvData.skills}}{{this}}, {{/each}}{{/if}}
{{#if cvData.achievements}}Achievements: {{#each cvData.achievements}}{{this}}, {{/each}}{{/if}}
{{#if cvData.workExperience}}Experience: {{#each cvData.workExperience}}{{this}}, {{/each}}{{/if}}
{{/if}}

**Guidelines:**

1. **Suggest exactly 5 universities** from across the UK university spectrum:
   - Include a mix of Russell Group and non-Russell Group universities
   - Range from highly competitive (Oxford, Cambridge, Imperial, LSE, etc.) to more accessible options
   - Consider: reputation for the subject, location diversity, course structure

2. **Be specific with course names:**
   - Use actual undergraduate degree titles (e.g., "BSc Computer Science", "BA History and Politics")
   - Match courses closely to student's stated interests
   - Ensure courses are realistic undergraduate programs

3. **Provide accurate grade requirements:**
   - Typical A-level offers should be realistic (e.g., "A*AA" for top universities, "BBB" for mid-tier)
   - Use standard UK grade formats: A*, A, B, C
   - Consider the competitiveness of both university and course

4. **Recommend key subjects:**
   - List 2-4 A-level subjects that are required or strongly recommended
   - Be specific (e.g., "Mathematics", "Physics", "Chemistry", not just "Science")
   - Include both essential and beneficial subjects

5. **Write compelling reasoning:**
   - Explain how the course connects to their interests
   - Mention specific course features or university strengths
   - Keep it concise (1-2 sentences)

**Example Output Structure:**

For a student interested in "Data Science", "Statistics", "Problem Solving":

1. Imperial College London - BSc Mathematics with Statistics
   - Reasoning: Combines rigorous mathematics training with statistical applications, ideal for data science careers
   - Typical Offer: A*A*A
   - Key Subjects: ["Mathematics", "Further Mathematics"]

2. University of Warwick - BSc Data Science
   - Reasoning: Specialist data science degree with strong industry links and focus on machine learning
   - Typical Offer: AAA
   - Key Subjects: ["Mathematics", "Further Mathematics or Computer Science"]

[Continue with 3 more diverse suggestions...]

Now generate 5 university suggestions for this student.`,
      });

      const result = await suggestPrompt(flowInput, {
        model: 'googleai/gemini-flash-lite-latest',
      });

      return result.output;
    },
    input
  );
}
