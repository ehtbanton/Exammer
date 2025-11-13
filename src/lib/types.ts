import type { AIPoweredInterviewOutput } from "@/ai/flows/ai-powered-interview";

export type ChatHistory = AIPoweredInterviewOutput['chatHistory'];

export interface PastPaper {
  id: string;
  name: string;
  content: string;
}

export interface Markscheme {
  id: string;
  name: string;
  content: string;
}

export interface ExamQuestion {
  id: string;
  questionText: string; // The ORIGINAL exam question from past papers (kept for reference, not displayed)
  summary: string; // One-sentence preview of the question
  score: number; // Percentage score (0-100) - calculated from objective completion
  attempts: number; // Number of times this question has been answered
  solutionObjectives?: string[]; // List of objectives/marking criteria for full marks
  completedObjectives?: number[]; // Indices of objectives the user has achieved
  markschemeId?: string | null; // Reference to the markscheme used
  paperDate?: string | null; // Exam date (e.g., '2022-06')
  questionNumber?: string | null; // Question identifier (e.g., '1-3-5')
  diagramMermaid?: string; // Optional mermaid diagram syntax for rendering diagrams
  categorizationConfidence?: number; // Confidence score (0-100) for AI categorization decision
  categorizationReasoning?: string; // Brief explanation of why this question was categorized into this topic
}

export interface Topic {
  id: string;
  name: string;
  description: string; // Info block about this topic from the syllabus
  examQuestions: ExamQuestion[];
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
  isCreator?: boolean; // True if current user created this subject
  pastPapers: PastPaper[];
  markschemes: Markscheme[];
  paperTypes: PaperType[];
}

export interface Donation {
  id: string;
  userId?: string | null;
  amount: number;
  currencyCode: string;
  donorName?: string | null;
  donorEmail?: string | null;
  donorMessage?: string | null;
  paypalInvoiceId?: string | null;
  paypalInvoiceUrl?: string | null;
  invoiceStatus: 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED' | 'REFUNDED';
  createdAt: number;
  updatedAt: number;
}

export interface CreateDonationRequest {
  amount: number;
  currencyCode?: string;
  donorName?: string;
  donorEmail?: string;
  donorMessage?: string;
}

export interface CreateDonationResponse {
  success: boolean;
  donation?: Donation;
  invoiceUrl?: string;
  error?: string;
}
