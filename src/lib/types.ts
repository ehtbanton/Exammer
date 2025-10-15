import type { AIPoweredInterviewOutput } from "@/ai/flows/ai-powered-interview";

export type ChatHistory = AIPoweredInterviewOutput['chatHistory'];

export interface PastPaper {
  id: string;
  name: string;
  content: string;
}

export interface Subsection {
  id: string;
  name: string;
  score: number; // Percentage score (0-100)
  attempts: number; // Number of times a question has been answered for this subsection
}

export interface Topic {
  id: string;
  name: string;
  subsections: Subsection[];
}

export interface PaperType {
  id: string;
  name: string;
  topics: Topic[];
}

export interface Subject {
  id: string;
  name: string;
  syllabusContent: string | null;
  pastPapers: PastPaper[];
  paperTypes: PaperType[];
}
