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
  diagramGeogebra?: string; // Optional GeoGebra commands as JSON array for rendering geometric diagrams
  diagramBounds?: string; // Optional JSON object with coordinate bounds (xmin, xmax, ymin, ymax)
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
// Feedback System Types
export type FeedbackCategory = 'bug' | 'feature' | 'improvement' | 'question' | 'other';
export type FeedbackStatus = 'new' | 'in_progress' | 'resolved' | 'closed' | 'archived';
export type FeedbackPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Feedback {
  id: string;
  userId?: string | null;
  category: FeedbackCategory;
  title: string;
  description: string;
  url?: string | null;
  screenshotUrl?: string | null;
  browserInfo?: string | null;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number | null;
}

export interface FeedbackNote {
  id: string;
  feedbackId: string;
  adminUserId: string;
  adminUserName?: string; // Joined from users table
  note: string;
  isInternal: boolean;
  createdAt: number;
}

export interface FeedbackStatusHistory {
  id: string;
  feedbackId: string;
  adminUserId?: string | null;
  adminUserName?: string | null; // Joined from users table
  oldStatus?: FeedbackStatus | null;
  newStatus: FeedbackStatus;
  changedAt: number;
}

export interface CreateFeedbackRequest {
  category: FeedbackCategory;
  title: string;
  description: string;
  url?: string;
  screenshotUrl?: string;
  browserInfo?: string;
}

export interface CreateFeedbackResponse {
  success: boolean;
  feedback?: Feedback;
  error?: string;
}

export interface UpdateFeedbackRequest {
  status?: FeedbackStatus;
  priority?: FeedbackPriority;
}

export interface UpdateFeedbackResponse {
  success: boolean;
  feedback?: Feedback;
  error?: string;
}

export interface CreateFeedbackNoteRequest {
  note: string;
  isInternal?: boolean;
}

export interface CreateFeedbackNoteResponse {
  success: boolean;
  note?: FeedbackNote;
  error?: string;
}

export interface FeedbackWithDetails extends Feedback {
  notes?: FeedbackNote[];
  statusHistory?: FeedbackStatusHistory[];
  userName?: string | null; // User who submitted feedback
  userEmail?: string | null;
}
