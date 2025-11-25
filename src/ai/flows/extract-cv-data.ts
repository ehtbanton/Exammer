'use server';

/**
 * @fileOverview Extracts structured data from CV/resume documents.
 *
 * - extractCvData - Extracts skills, achievements, awards, work experience, and personal statement from CV
 * - ExtractCvDataInput - The input type for the extractCvData function
 * - ExtractCvDataOutput - The return type for the extractCvData function
 */

import { z } from 'genkit';
import { executeWithManagedKey } from '@/ai/genkit';

const ExtractCvDataInputSchema = z.object({
  cvContent: z.string().describe('The text content extracted from the CV/resume document'),
  cvFileName: z.string().describe('The original filename of the CV'),
});
export type ExtractCvDataInput = z.infer<typeof ExtractCvDataInputSchema>;

const WorkExperienceSchema = z.object({
  role: z.string().describe('Job title or role'),
  organization: z.string().describe('Company, school, or organization name'),
  description: z.string().describe('Brief description of responsibilities and achievements'),
  duration: z.string().optional().describe('Time period (e.g., "2020-2022", "6 months")'),
});

const ExtractCvDataOutputSchema = z.object({
  skills: z.array(z.string()).describe('List of skills mentioned in the CV (technical, soft skills, languages, etc.)'),
  achievements: z.array(z.string()).describe('Notable achievements, accomplishments, or recognitions'),
  awards: z.array(z.string()).describe('Awards, honors, scholarships, or prizes received'),
  workExperience: z.array(WorkExperienceSchema).describe('Work experience, internships, volunteering, or leadership positions'),
  personalStatement: z.string().describe('Personal statement, summary, or objective if present in the CV'),
  education: z.string().optional().describe('Current education level and subjects being studied'),
});
export type ExtractCvDataOutput = z.infer<typeof ExtractCvDataOutputSchema>;

/**
 * Extracts structured data from a CV/resume document
 */
export async function extractCvData(
  input: ExtractCvDataInput
): Promise<ExtractCvDataOutput> {
  return await executeWithManagedKey(async (ai) => {
    const extractCvPrompt = ai.definePrompt({
      name: 'extractCvData',
      input: {
        schema: ExtractCvDataInputSchema,
      },
      output: {
        schema: ExtractCvDataOutputSchema,
      },
      prompt: `You are an expert CV/resume parser. Your task is to extract structured information from a student's CV or resume.

The CV content is provided below. Extract the following information:

1. **Skills**: All skills mentioned (technical skills, soft skills, programming languages, spoken languages, certifications, etc.)
2. **Achievements**: Notable accomplishments, successes, or recognitions (academic, extracurricular, personal projects)
3. **Awards**: Formal awards, honors, scholarships, prizes, or distinctions received
4. **Work Experience**: All work experience, internships, volunteering, leadership positions, or relevant activities
   - For each experience, extract: role, organization, description, and duration if mentioned
5. **Personal Statement**: Any personal statement, career objective, or summary section
6. **Education**: Current education level, school/college, subjects being studied

**Important guidelines:**
- Be thorough but avoid repetition
- If a section is not present or empty, return an empty array/string
- For work experience, include school leadership roles, clubs, societies, volunteering, and internships
- Extract achievements that demonstrate initiative, leadership, or exceptional performance
- For personal statement, if there are multiple paragraphs, combine them into one coherent statement

**CV Filename:** {{cvFileName}}

**CV Content:**
{{cvContent}}

Extract all relevant information and return it in the structured format.`,
    }, { model: 'googleai/gemini-2.0-flash-exp' });

    const result = await extractCvPrompt(input);

    return result.output;
  });
}
