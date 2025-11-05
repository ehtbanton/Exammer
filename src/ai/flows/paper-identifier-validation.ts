/**
 * @fileOverview Strict validation rules for paper and question identifiers.
 *
 * Paper Date Format: YYYY-MM-P
 * - YYYY: 4-digit year (e.g., 2022, 2023)
 * - MM: 2-digit month (01-12)
 * - P: 1-digit paper type index (0-9)
 * Example: "2022-06-1" = June 2022, Paper Type Index 1
 *
 * Paper Question ID Format: YYYY-MM-P-Q-T
 * - YYYY-MM-P: Paper date
 * - Q: Question number (1-99)
 * - T: Topic index (0-99)
 * Example: "2022-06-1-3-5" = June 2022, Paper 1, Question 3, Topic 5
 *
 * Markscheme Solution ID Format: YYYY-MM-P-Q
 * - YYYY-MM-P: Paper date
 * - Q: Question number (1-99)
 * Example: "2022-06-1-3" = June 2022, Paper 1, Question 3
 *
 * NOTE: Only dated papers are processed. Specimen/sample papers are ignored.
 */

/**
 * Regular expression pattern for valid paper dates.
 * Format: YYYY-MM-P
 */
const PAPER_DATE_REGEX = /^(\d{4})-(0[1-9]|1[0-2])-([0-9])$/;

/**
 * Regular expression pattern for paper question identifiers (with topic).
 * Format: YYYY-MM-P-Q-T where Q is 1-99, T is 0-99
 */
const PAPER_QUESTION_ID_REGEX = /^(\d{4})-(0[1-9]|1[0-2])-([0-9])-([1-9][0-9]?)-([0-9]|[1-9][0-9])$/;

/**
 * Regular expression pattern for markscheme solution identifiers (no topic).
 * Format: YYYY-MM-P-Q where Q is 1-99
 */
const SOLUTION_ID_REGEX = /^(\d{4})-(0[1-9]|1[0-2])-([0-9])-([1-9][0-9]?)$/;

/**
 * Validates whether a paper date follows the required format.
 *
 * @param paperDate - The paper date to validate
 * @returns true if valid, false otherwise
 */
export function isValidPaperIdentifier(paperDate: string): boolean {
  if (!paperDate || typeof paperDate !== 'string') {
    return false;
  }

  return PAPER_DATE_REGEX.test(paperDate.trim());
}

/**
 * Generates a detailed error message for an invalid paper date.
 *
 * @param paperDate - The invalid date
 * @returns Error message with examples of valid formats
 */
export function getPaperIdentifierErrorMessage(paperDate: string): string {
  return `Invalid paper date: "${paperDate}". Required format: "YYYY-MM-P" where YYYY=year (4 digits), MM=month (01-12), P=paper type index (0-9). Example: "2022-06-1" for June 2022, Paper Type 1.`;
}

/**
 * Format requirements for paper dates and question IDs (used in prompts).
 */
export const PAPER_DATE_FORMAT_RULES = {
  description: 'Paper date must follow exact character-wise format',
  format: 'YYYY-MM-P',
  structure: {
    year: 'YYYY: 4-digit year (e.g., 2022, 2023, 2024)',
    month: 'MM: 2-digit month, zero-padded (01=January, 02=February, ..., 12=December)',
    paperType: 'P: 1-digit paper type index (0, 1, 2, etc.)'
  },
  requirements: [
    'Extract year from document (4 digits)',
    'Extract month from document, convert to 2-digit format (01-12)',
    'Use exact paper type index from provided list (0-based)',
    'Use hyphens as separators',
    'No spaces, no additional text'
  ],
  examples: {
    valid: [
      '2022-06-0 (June 2022, Paper Type 0)',
      '2023-11-1 (November 2023, Paper Type 1)',
      '2024-03-2 (March 2024, Paper Type 2)',
      '2021-01-0 (January 2021, Paper Type 0)'
    ],
    invalid: [
      '2022-6-0 (month not zero-padded)',
      '22-06-0 (year not 4 digits)',
      '2022/06/0 (wrong separator)',
      '2022-06-10 (paper type must be single digit)',
      'June 2022-0 (wrong format)'
    ]
  }
} as const;

export const PAPER_QUESTION_ID_FORMAT_RULES = {
  description: 'Paper question ID combines date, question number, and topic index',
  format: 'YYYY-MM-P-Q-T',
  structure: {
    paperDate: 'YYYY-MM-P: Paper date',
    questionNumber: 'Q: Question number (1-99)',
    topicIndex: 'T: Topic index from topics list (0-99)'
  },
  requirements: [
    'Combine paper date, question number, and topic index',
    'Use hyphen separators',
    'Question number without zero-padding (1, 2, 3)',
    'Topic index matches position in topics list (0-based)'
  ],
  examples: {
    valid: [
      '2022-06-1-1-0 (June 2022, Paper 1, Question 1, Topic 0)',
      '2023-11-0-5-3 (November 2023, Paper 0, Question 5, Topic 3)',
      '2024-03-2-12-15 (March 2024, Paper 2, Question 12, Topic 15)'
    ],
    invalid: [
      '2022-06-1-1 (missing topic index)',
      '2022-06-1-01-0 (question number zero-padded)',
      '2022-06-1-1-T0 (extra characters)'
    ]
  }
} as const;

export const SOLUTION_ID_FORMAT_RULES = {
  description: 'Solution ID combines date and question number (no topic)',
  format: 'YYYY-MM-P-Q',
  structure: {
    paperDate: 'YYYY-MM-P: Paper date',
    questionNumber: 'Q: Question number (1-99)'
  },
  requirements: [
    'Combine paper date with question number',
    'Use hyphen separator',
    'Question number without zero-padding (1, 2, 3)'
  ],
  examples: {
    valid: [
      '2022-06-1-1 (June 2022, Paper 1, Question 1)',
      '2023-11-0-5 (November 2023, Paper 0, Question 5)',
      '2024-03-2-12 (March 2024, Paper 2, Question 12)'
    ],
    invalid: [
      '2022-06-1 (missing question number)',
      '2022-06-1-01 (question number zero-padded)',
      '2022-06-1-Q1 (extra characters)'
    ]
  }
} as const;

/**
 * Month name to number mapping for conversion.
 */
export const MONTH_MAP: Record<string, string> = {
  'january': '01', 'jan': '01',
  'february': '02', 'feb': '02',
  'march': '03', 'mar': '03',
  'april': '04', 'apr': '04',
  'may': '05',
  'june': '06', 'jun': '06',
  'july': '07', 'jul': '07',
  'august': '08', 'aug': '08',
  'september': '09', 'sep': '09', 'sept': '09',
  'october': '10', 'oct': '10',
  'november': '11', 'nov': '11',
  'december': '12', 'dec': '12'
};

/**
 * Returns formatted rules for paper date (used in prompts).
 */
export function getPaperIdentifierPromptRules(): string {
  const rules = PAPER_DATE_FORMAT_RULES;

  return `
PAPER DATE FORMAT (MANDATORY):

Required Format: ${rules.format}

Structure:
- ${rules.structure.year}
- ${rules.structure.month}
- ${rules.structure.paperType}

Requirements:
${rules.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Valid Examples:
${rules.examples.valid.map(ex => `✓ ${ex}`).join('\n')}

Invalid Examples:
${rules.examples.invalid.map(ex => `✗ ${ex}`).join('\n')}

CRITICAL: Format must be exact. Character-by-character compliance is mandatory.
`.trim();
}

/**
 * Returns formatted rules for paper question ID (used in paper extraction prompts).
 */
export function getPaperQuestionIdPromptRules(): string {
  const rules = PAPER_QUESTION_ID_FORMAT_RULES;

  return `
PAPER QUESTION ID FORMAT (MANDATORY):

Required Format: ${rules.format}

Structure:
- ${rules.structure.paperDate}
- ${rules.structure.questionNumber}
- ${rules.structure.topicIndex}

Requirements:
${rules.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Valid Examples:
${rules.examples.valid.map(ex => `✓ ${ex}`).join('\n')}

Invalid Examples:
${rules.examples.invalid.map(ex => `✗ ${ex}`).join('\n')}

CRITICAL: Format must be exact. Output question ID as single atomic string with topic index.
`.trim();
}

/**
 * Returns formatted rules for solution ID (used in markscheme extraction prompts).
 */
export function getSolutionIdPromptRules(): string {
  const rules = SOLUTION_ID_FORMAT_RULES;

  return `
SOLUTION ID FORMAT (MANDATORY):

Required Format: ${rules.format}

Structure:
- ${rules.structure.paperDate}
- ${rules.structure.questionNumber}

Requirements:
${rules.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Valid Examples:
${rules.examples.valid.map(ex => `✓ ${ex}`).join('\n')}

Invalid Examples:
${rules.examples.invalid.map(ex => `✗ ${ex}`).join('\n')}

CRITICAL: Format must be exact. Output solution ID as single atomic string (no topic).
`.trim();
}
