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

export type DiagramType = 'mermaid' | 'imagen';
export type DiagramStyle = 'technical' | 'hand-drawn' | 'minimalist' | 'detailed';

// Detailed diagram data for accurate regeneration
export interface DiagramDetailedData {
  type: string; // Specific diagram type (e.g., 'triangle', 'bar_chart', 'circuit')
  measurements?: {
    lengths?: string[]; // e.g., ["AB = 5 cm", "BC = 3 cm"]
    angles?: string[]; // e.g., ["angle ABC = 90 degrees"]
    other?: string[]; // Other measurements
  };
  elements?: Array<{
    id: string;
    label: string;
    type?: string;
  }>;
  connections?: Array<{
    from: string;
    to: string;
    label?: string;
    type?: string;
  }>;
  labels?: string[];
  specialProperties?: string[];
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
  diagramType?: DiagramType | null; // Type of diagram rendering: 'mermaid' or 'imagen'
  diagramImageUri?: string | null; // Base64 data URI for Imagen-generated images
  diagramOriginalImageUri?: string | null; // Base64 data URI for original diagram extracted from PDF (Tier 1 - 100% accurate)
  diagramAspectRatio?: string; // Aspect ratio for image generation (e.g., '1:1', '16:9', '3:4')
  diagramStyle?: DiagramStyle; // Style preference for image generation
  diagramDetailedData?: DiagramDetailedData | null; // Detailed structured diagram data for accurate regeneration
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
