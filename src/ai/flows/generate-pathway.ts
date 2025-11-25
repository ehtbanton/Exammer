'use server';

/**
 * @fileOverview Generates personalized month-by-month pathway to university goal.
 *
 * - generatePathway - Creates detailed pathway with milestones, grade targets, and recommendations
 * - GeneratePathwayInput - The input type for the generatePathway function
 * - GeneratePathwayOutput - The return type for the generatePathway function
 */

import { z } from 'genkit';
import { executeWithManagedKey } from '@/ai/genkit';

const MilestoneSchema = z.object({
  month: z.string().describe('Month and year (e.g., "January 2025")'),
  title: z.string().describe('Brief milestone title'),
  description: z.string().describe('Detailed description of what to achieve this month'),
  category: z.enum(['academic', 'extracurricular', 'application', 'skill-building']).describe('Type of milestone'),
  priority: z.enum(['essential', 'important', 'optional']).describe('How critical this milestone is'),
});

const SubjectGradeTargetSchema = z.object({
  subjectName: z.string().describe('Name of A-level subject'),
  currentLevel: z.string().optional().describe('Current estimated grade (if known)'),
  targetGrade: z.string().describe('Target grade needed'),
  keyFocusAreas: z.array(z.string()).describe('2-4 specific areas to focus on in this subject'),
});

const ExtracurricularRecommendationSchema = z.object({
  activity: z.string().describe('Recommended extracurricular activity'),
  reasoning: z.string().describe('Why this activity supports the university goal'),
  timeCommitment: z.string().describe('Suggested time commitment (e.g., "2 hours/week")'),
  priority: z.enum(['high', 'medium', 'low']).describe('Priority level'),
});

const GeneratePathwayInputSchema = z.object({
  // Goal information
  universityName: z.string().describe('Target university'),
  courseName: z.string().describe('Target course'),
  entryRequirements: z.string().optional().describe('Entry grade requirements'),
  requiredSubjects: z.array(z.string()).optional().describe('Required A-level subjects'),

  // Student context
  currentYearGroup: z.string().optional().describe('Current year group'),
  currentSchool: z.string().optional().describe('Current school'),
  targetApplicationYear: z.number().describe('Year when applying to university'),

  // Performance data
  weakTopics: z.array(z.object({
    topicName: z.string(),
    subjectName: z.string(),
    priority: z.string(),
    reasoning: z.string(),
  })).optional().describe('Topics needing improvement from performance analysis'),

  // CV data
  cvData: z.object({
    skills: z.array(z.string()).optional(),
    achievements: z.array(z.string()).optional(),
    workExperience: z.array(z.string()).optional(),
  }).optional(),

  // Brainstorming interests
  interests: z.array(z.string()).optional(),
});
export type GeneratePathwayInput = z.infer<typeof GeneratePathwayInputSchema>;

const GeneratePathwayOutputSchema = z.object({
  pathwayTitle: z.string().describe('Engaging title for this pathway'),
  overviewSummary: z.string().describe('2-3 sentence summary of the pathway'),
  milestones: z.array(MilestoneSchema).describe('Month-by-month milestones from now until application'),
  subjectGradeTargets: z.array(SubjectGradeTargetSchema).describe('Grade targets for each subject'),
  extracurriculars: z.array(ExtracurricularRecommendationSchema).describe('Recommended extracurricular activities'),
  applicationTimeline: z.object({
    ucasDeadline: z.string().describe('UCAS application deadline date'),
    personalStatementStart: z.string().describe('When to start personal statement'),
    referenceRequest: z.string().describe('When to request teacher references'),
  }).describe('Key UCAS application dates'),
});
export type GeneratePathwayOutput = z.infer<typeof GeneratePathwayOutputSchema>;

/**
 * Generates a personalized pathway to university goal
 */
export async function generatePathway(
  input: GeneratePathwayInput
): Promise<GeneratePathwayOutput> {
  return await executeWithManagedKey(async (ai) => {
    const generatePrompt = ai.definePrompt({
      name: 'generatePathway',
      input: {
        schema: GeneratePathwayInputSchema,
      },
      output: {
        schema: GeneratePathwayOutputSchema,
      },
      prompt: `You are an expert university admissions advisor creating a personalized pathway plan for a UK student.

**University Goal:**
- University: {{universityName}}
- Course: {{courseName}}
{{#if entryRequirements}}
- Entry Requirements: {{entryRequirements}}
{{/if}}
{{#if requiredSubjects}}
- Required Subjects: {{#each requiredSubjects}}{{this}}, {{/each}}
{{/if}}

**Student Context:**
{{#if currentYearGroup}}
- Current Year: {{currentYearGroup}}
{{/if}}
{{#if currentSchool}}
- School: {{currentSchool}}
{{/if}}
- Target Application Year: {{targetApplicationYear}}

{{#if weakTopics}}
**Areas Needing Improvement (from Exammer performance):**
{{#each weakTopics}}
- {{subjectName}} - {{topicName}} ({{priority}} priority): {{reasoning}}
{{/each}}
{{/if}}

{{#if cvData}}
**Current Profile:**
{{#if cvData.skills}}Skills: {{#each cvData.skills}}{{this}}, {{/each}}{{/if}}
{{#if cvData.achievements}}Achievements: {{#each cvData.achievements}}{{this}}, {{/each}}{{/if}}
{{#if cvData.workExperience}}Experience: {{#each cvData.workExperience}}{{this}}, {{/each}}{{/if}}
{{/if}}

{{#if interests}}
**Interests:** {{#each interests}}{{this}}, {{/each}}
{{/if}}

**Task: Create a Month-by-Month Pathway**

Generate a comprehensive, actionable pathway from **now** until the UCAS application deadline in {{targetApplicationYear}}.

**Guidelines:**

1. **Milestones** (month-by-month plan):
   - Start from current month and go until October {{targetApplicationYear}}
   - Each month should have 2-4 specific, achievable milestones
   - Mix of: academic work, exam prep, extracurriculars, skill development, application tasks
   - Be realistic about A-level exam schedules (mocks, finals)
   - Include topic improvement milestones that reference weak areas from Exammer
   - Essential milestones: must-do items; Important: strongly recommended; Optional: nice-to-have

2. **Subject Grade Targets**:
   - For each required subject (and relevant A-levels), specify target grade
   - If entry requirements are "AAA", distribute realistically (e.g., one A* is safer)
   - List 2-4 key focus areas per subject
   - If weak topics identified, reference them in focus areas

3. **Extracurricular Recommendations**:
   - Suggest 3-5 activities that enhance university application
   - Must be relevant to the course (e.g., coding projects for CS, volunteering for Medicine)
   - Realistic time commitments for a busy student
   - Prioritize: high = very important for this specific course

4. **Application Timeline**:
   - UCAS deadline: October 15 for Oxford/Cambridge/Medicine, January 31 for others
   - Personal statement: start 3-4 months before deadline
   - References: request 2 months before deadline

5. **Make it Personal**:
   - Reference their interests and achievements
   - Connect weak topics to improvement milestones
   - Show how activities build toward the goal
   - Be encouraging and realistic

**Example Milestone:**
{
  "month": "March 2025",
  "title": "Master Calculus Fundamentals",
  "description": "Focus on improving differentiation and integration skills identified as weak areas. Complete 20 practice questions on Exammer, aiming for 80%+ scores. Review mark schemes to understand where marks are lost.",
  "category": "academic",
  "priority": "essential"
}

Generate the complete pathway now.`,
    }, { model: 'googleai/gemini-2.0-flash-exp' });

    const result = await generatePrompt(input);

    return result.output;
  });
}
