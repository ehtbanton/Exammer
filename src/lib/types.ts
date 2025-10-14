import type { ChatHistory } from "@/ai/flows/ai-powered-interview";

export interface PastPaper {
  id: string;
  name: string;
  content: string;
}

export interface Subsection {
  id: string;
  name: string;
  score: number;
}

export interface Topic {
  id: string;
  name: string;
  subsections: Subsection[];
}

export interface Exam {
  id: string;
  name: string;
  syllabusContent: string | null;
  pastPapers: PastPaper[];
  topics: Topic[];
}

export type { ChatHistory };
