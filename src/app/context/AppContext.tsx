"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import type { Subject, Topic, ExamQuestion, PastPaper, PaperType, Markscheme } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { decomposeSyllabus } from '@/ai/flows/decompose-syllabus-into-topics';
import { generateSimilarQuestion } from '@/ai/flows/generate-similar-question';
import { backgroundQueue } from '@/lib/background-queue';

// New types for lazy loading
interface SubjectPreview {
  id: string;
  name: string;
  paperTypesCount: number;
  isCreator: boolean;
}

interface PaperTypeWithMetrics {
  id: string;
  name: string;
  subject_id: string;
  total_questions: number;
  attempted_questions: number;
  avg_score: number | null;
}

interface TopicWithMetrics {
  id: string;
  name: string;
  description: string;
  paper_type_id: string;
  total_questions: number;
  attempted_questions: number;
  avg_score: number | null;
}

interface QuestionPreview {
  id: string;
  summary: string;
  topic_id: string;
  has_markscheme: number;
  score: number;
  attempts: number;
}

interface FullQuestion {
  id: string;
  topic_id: string;
  question_text: string;
  summary: string;
  solution_objectives?: string[];
  diagram_mermaid?: string;
  markscheme_id?: number;
  paper_date?: string;
  question_number?: string;
  categorization_confidence?: number;
  categorization_reasoning?: string;
  score: number;
  attempts: number;
  completed_objectives: number[];
}

interface AppContextType {
  subjects: Subject[];
  otherSubjects: Subject[];
  isLevel3User: boolean;
  cacheVersion: number; // Version counter that increments when caches are invalidated
  // Lazy loading functions
  loadSubjectsList: () => Promise<SubjectPreview[]>;
  loadPaperTypes: (subjectId: string) => Promise<PaperTypeWithMetrics[]>;
  loadTopics: (paperTypeId: string) => Promise<TopicWithMetrics[]>;
  loadQuestions: (topicId: string) => Promise<QuestionPreview[]>;
  loadFullQuestion: (questionId: string) => Promise<FullQuestion>;
  // Cache invalidation functions
  invalidateSubjectsCache: () => void;
  invalidatePaperTypesCache: (subjectId: string) => void;
  invalidateTopicsCache: (paperTypeId: string) => void;
  invalidateQuestionsCache: (topicId: string) => void;
  invalidateFullQuestionCache: (questionId: string) => void;
  // Original functions
  createSubjectFromSyllabus: (syllabusFile: File) => Promise<void>;
  processExamPapers: (subjectId: string, examPapers: File[]) => Promise<void>;
  processMarkschemes: (subjectId: string, markschemes: File[]) => Promise<void>;
  deleteSubject: (subjectId: string) => Promise<void>;
  addSubjectToWorkspace: (subjectId: string) => Promise<void>;
  removeSubjectFromWorkspace: (subjectId: string) => Promise<void>;
  searchSubjects: (query: string) => Promise<void>;
  getSubjectById: (subjectId: string) => Subject | undefined;
  addPastPaperToSubject: (subjectId: string, paperFile: File) => Promise<void>;
  updateExamQuestionScore: (subjectId: string, paperTypeName: string, topicName: string, questionId: string, score: number) => void;
  generateQuestionVariant: (subjectId: string, paperTypeId: string, topicId: string, questionId: string) => Promise<{ questionText: string; solutionObjectives: string[]; diagramMermaid?: string }>;
  isLoading: (key: string) => boolean;
  setLoading: (key: string, value: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [otherSubjects, setOtherSubjects] = useState<Subject[]>([]);
  const [isLevel3User, setIsLevel3User] = useState<boolean>(false);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const { data: session, status} = useSession();

  // Fetch subjects from API when session changes
  useEffect(() => {
    const fetchSubjects = async () => {
      // Clear subjects if no session
      if (!session?.user) {
        setSubjects([]);
        setOtherSubjects([]);
        setIsLevel3User(false);
        setLoadingStates(prev => ({ ...prev, 'fetch-subjects': false }));
        return;
      }

      setLoadingStates(prev => ({ ...prev, 'fetch-subjects': true }));
      try {
        // Fetch user's access level
        const accessLevelResponse = await fetch('/api/auth/access-level');
        if (accessLevelResponse.ok) {
          const { accessLevel } = await accessLevelResponse.json();
          setIsLevel3User(accessLevel >= 3);
        }

        // NOTE: We no longer load full subject data upfront for better performance
        // Pages should use the new lazy loading functions: loadPaperTypes, loadTopics, loadQuestions
        // The 'subjects' state is kept for backward compatibility with some functions that still depend on it
        // but it will only be populated when needed (e.g., after creating/processing subjects)
        setSubjects([]);
      } catch (error) {
        console.error("Failed to fetch user data:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to load user data" });
      } finally {
        setLoadingStates(prev => ({ ...prev, 'fetch-subjects': false }));
      }
    };

    // Only fetch when session status is authenticated
    if (status === 'authenticated') {
      fetchSubjects();
    } else if (status === 'unauthenticated') {
      setSubjects([]);
      setOtherSubjects([]);
      setLoadingStates(prev => ({ ...prev, 'fetch-subjects': false }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, status]);

  const setLoading = useCallback((key: string, value: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  }, []);

  const isLoading = useCallback((key: string) => !!loadingStates[key], [loadingStates]);

  // NEW: Lazy loading state caches - defined early to avoid circular dependencies
  const [subjectsListCache, setSubjectsListCache] = useState<SubjectPreview[] | null>(null);
  const [paperTypesCache, setPaperTypesCache] = useState<Record<string, PaperTypeWithMetrics[]>>({});
  const [topicsCache, setTopicsCache] = useState<Record<string, TopicWithMetrics[]>>({});
  const [questionsCache, setQuestionsCache] = useState<Record<string, QuestionPreview[]>>({});
  const [fullQuestionsCache, setFullQuestionsCache] = useState<Record<string, FullQuestion>>({});

  // Cache version counter to trigger UI updates when cache changes
  const [cacheVersion, setCacheVersion] = useState(0);

  // NEW: Cache invalidation functions - defined early so they can be used in other callbacks
  const invalidateSubjectsCache = useCallback(() => {
    setSubjectsListCache(null);
    setCacheVersion(v => v + 1);
  }, []);

  const invalidatePaperTypesCache = useCallback((subjectId: string) => {
    setPaperTypesCache(prev => {
      const newCache = { ...prev };
      delete newCache[subjectId];
      return newCache;
    });
    setCacheVersion(v => v + 1);
  }, []);

  const invalidateTopicsCache = useCallback((paperTypeId: string) => {
    setTopicsCache(prev => {
      const newCache = { ...prev };
      delete newCache[paperTypeId];
      return newCache;
    });
    setCacheVersion(v => v + 1);
  }, []);

  const invalidateQuestionsCache = useCallback((topicId: string) => {
    setQuestionsCache(prev => {
      const newCache = { ...prev };
      delete newCache[topicId];
      return newCache;
    });
    setCacheVersion(v => v + 1);
  }, []);

  const invalidateFullQuestionCache = useCallback((questionId: string) => {
    setFullQuestionsCache(prev => {
      const newCache = { ...prev };
      delete newCache[questionId];
      return newCache;
    });
    setCacheVersion(v => v + 1);
  }, []);

  const createSubjectFromSyllabus = useCallback(async (syllabusFile: File): Promise<string | null> => {
    const loadingKey = `create-subject`;
    setLoading(loadingKey, true);

    try {
      const syllabusDataUri = await fileToDataURI(syllabusFile);
      const syllabusText = await fileToString(syllabusFile);

      // Create subject in database via API
      const response = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Processing...',
          syllabusContent: syllabusText
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create subject');
      }

      const dbSubject = await response.json();
      const subjectId = dbSubject.id.toString();

      // Create placeholder subject in local state with isCreator set to true
      const placeholderSubject: Subject = {
        id: subjectId,
        name: 'Processing...',
        syllabusContent: syllabusText,
        pastPapers: [],
        paperTypes: [],
        isCreator: true,
      };

      setSubjects(prev => [...prev, placeholderSubject]);

      // Create Process A task and add it to the queue
      const processAId = `process-a-${subjectId}`;
      const taskA = backgroundQueue.addTask({
        id: processAId,
        type: 'process_a',
        status: 'pending',
        displayName: 'P_A: Determining paper types and topics...',
        subjectId,
        execute: async () => {
          console.log('Starting syllabus processing...');
          // Decompose syllabus into paper types and topics
          const result = await decomposeSyllabus({ syllabusDataUri });
          console.log('Syllabus processing complete.');

          // Update subject name in database
          const updateNameResponse = await fetch(`/api/subjects/${subjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: result.subjectName || 'Untitled Subject' })
          });

          if (!updateNameResponse.ok) {
            const errorData = await updateNameResponse.json();
            throw new Error(`Failed to update subject name: ${errorData.error || 'Unknown error'}`);
          }

          // Create paper types in database and get their IDs
          const createdPaperTypes: PaperType[] = [];
          for (const pt of result.paperTypes || []) {
            const ptResponse = await fetch(`/api/subjects/${subjectId}/paper-types`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: pt.name })
            });

            if (!ptResponse.ok) {
              const errorData = await ptResponse.json();
              throw new Error(`Failed to create paper type "${pt.name}": ${errorData.error || 'Unknown error'}`);
            }

            const dbPaperType = await ptResponse.json();

            // Create topics for this paper type
            const createdTopics = [];
            for (const topic of pt.topics || []) {
              const topicResponse = await fetch(`/api/paper-types/${dbPaperType.id}/topics`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: topic.name, description: topic.description })
              });

              if (!topicResponse.ok) {
                const errorData = await topicResponse.json();
                throw new Error(`Failed to create topic "${topic.name}": ${errorData.error || 'Unknown error'}`);
              }

              const dbTopic = await topicResponse.json();
              createdTopics.push({
                id: dbTopic.id.toString(),
                name: dbTopic.name,
                description: dbTopic.description || '',
                examQuestions: []
              });
            }

            createdPaperTypes.push({
              id: dbPaperType.id.toString(),
              name: dbPaperType.name,
              topics: createdTopics
            });
          }

          // Update local state with the created data
          setSubjects(prev => prev.map(s =>
            s.id === subjectId
              ? { ...s, name: result.subjectName || 'Untitled Subject', paperTypes: createdPaperTypes }
              : s
          ));

          // Store result for Process B to use
          const task = backgroundQueue.getTaskById(processAId);
          if (task) {
            task.result = { paperTypes: createdPaperTypes };
          }

          toast({
            title: "Syllabus Processed",
            description: `"${result.subjectName}" with ${createdPaperTypes.length} paper types identified.`
          });
        }
      });

      return subjectId;
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to start syllabus processing." });
      return null;
    } finally {
      setLoading(loadingKey, false);
    }
  }, [toast, setLoading]);

  const processExamPapers = useCallback(async (subjectId: string, examPapers: File[]) => {
    const loadingKey = `process-papers-${subjectId}`;
    setLoading(loadingKey, true);

    try {
      // Get current subject to check if we have paper types
      const currentSubject = subjects.find(s => s.id === subjectId);
      if (!currentSubject) {
        throw new Error('Subject not found');
      }

      // Pre-process exam papers for storage
      const examPapersDataUris = await Promise.all(examPapers.map(file => fileToDataURI(file)));

      // Persist past papers to database
      const pastPapers: PastPaper[] = [];
      for (const paperFile of examPapers) {
        const paperContent = await fileToString(paperFile);

        // Save to database via API
        const response = await fetch(`/api/subjects/${subjectId}/papers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: paperFile.name,
            content: paperContent
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to save past paper: ${paperFile.name}`);
        }

        const dbPaper = await response.json();
        pastPapers.push({
          id: dbPaper.id.toString(),
          name: dbPaper.name,
          content: dbPaper.content,
        });
      }

      // Update local state with persisted papers
      setSubjects(prev => prev.map(s =>
        s.id === subjectId ? {
          ...s,
          pastPapers: [...s.pastPapers, ...pastPapers]
        } : s
      ));

      // Check if Process A exists and is not yet complete
      const processAId = `process-a-${subjectId}`;
      const processATask = backgroundQueue.getTaskById(processAId);
      const needsToWaitForProcessA = processATask && processATask.status !== 'completed';

      // Create Process B task and add it to the queue
      const processBId = `process-b-${subjectId}-${Date.now()}`;
      backgroundQueue.addTask({
        id: processBId,
        type: 'process_b',
        status: 'pending',
        displayName: 'P_B: Extracting and categorizing PPQs...',
        subjectId,
        dependsOn: needsToWaitForProcessA ? processAId : undefined, // Only wait if Process A is running
        execute: async () => {
          // Get paper types - either from Process A result or from current subject state
          let paperTypes: PaperType[];

          if (needsToWaitForProcessA && processATask?.result) {
            // Use Process A result if we waited for it
            paperTypes = processATask.result.paperTypes;
          } else {
            // Otherwise fetch from API to get latest paper types with topics
            const response = await fetch(`/api/subjects/${subjectId}`);
            if (!response.ok) {
              throw new Error('Failed to fetch subject');
            }
            const apiSubject = await response.json();
            if (!apiSubject || !apiSubject.paperTypes || apiSubject.paperTypes.length === 0) {
              throw new Error('No paper types found for question extraction');
            }
            // Convert API format to client format
            paperTypes = apiSubject.paperTypes.map((pt: any) => ({
              id: pt.id.toString(),
              name: pt.name,
              topics: (pt.topics || []).map((t: any) => ({
                id: t.id.toString(),
                name: t.name,
                description: t.description || '',
                examQuestions: []
              }))
            }));
          }

          // Use batch API endpoint for parallel processing on server
          console.log(`[Process B] Calling batch API to extract ${examPapersDataUris.length} papers (no markschemes)`);

          const batchResponse = await fetch('/api/extract-questions-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subjectId,
              examPapersDataUris,
              markschemesDataUris: [], // No markschemes in Process B
              paperTypes
            })
          });

          if (!batchResponse.ok) {
            const errorData = await batchResponse.json();
            throw new Error(`Batch extraction failed: ${errorData.error || 'Unknown error'}`);
          }

          const batchResult = await batchResponse.json();
          console.log(`[Process B] Batch extraction complete: ${batchResult.questionsExtracted} extracted, ${batchResult.questionsSaved} saved`);

          // Fetch updated subject from database to get all questions with their IDs
          const subjectResponse = await fetch(`/api/subjects/${subjectId}`);
          if (!subjectResponse.ok) {
            throw new Error('Failed to fetch updated subject');
          }

          const updatedSubjectData = await subjectResponse.json();

          // Convert API format to client format
          const updatedPaperTypes = updatedSubjectData.paperTypes.map((pt: any) => ({
            id: pt.id.toString(),
            name: pt.name,
            topics: (pt.topics || []).map((t: any) => ({
              id: t.id.toString(),
              name: t.name,
              description: t.description || '',
              examQuestions: (t.examQuestions || []).map((q: any) => ({
                id: q.id.toString(),
                questionText: q.question_text,
                summary: q.summary,
                score: q.score || (q.attempts === 0 ? 50 : 0), // Default 50% if no attempts
                attempts: q.attempts || 0,
                solutionObjectives: q.solutionObjectives || undefined,
                completedObjectives: q.completedObjectives || [],
                paperDate: q.paperDate || null,
                questionNumber: q.questionNumber || null,
              }))
            }))
          }));

          // Update local state with the fresh data from database
          setSubjects(prev => prev.map(s => {
            if (s.id !== subjectId) return s;
            return {
              ...s,
              paperTypes: updatedPaperTypes
            };
          }));

          // Invalidate caches for this subject since paper types, topics, and questions changed
          invalidatePaperTypesCache(subjectId);
          // Invalidate all topics and questions caches for this subject
          updatedPaperTypes.forEach((pt: any) => {
            invalidateTopicsCache(pt.id);
            pt.topics.forEach((t: any) => {
              invalidateQuestionsCache(t.id);
            });
          });

          toast({
            title: "Questions Extracted",
            description: `Saved ${batchResult.questionsSaved} questions from ${examPapers.length} paper(s) to database.`
          });
        }
      });

      const message = needsToWaitForProcessA
        ? `${examPapers.length} paper(s) uploaded. Question extraction will begin after syllabus processing completes.`
        : `${examPapers.length} paper(s) uploaded. Starting question extraction...`;

      toast({
        title: "Papers Uploaded",
        description: message
      });

    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to process exam papers." });
    } finally {
      setLoading(loadingKey, false);
    }
  }, [subjects, toast, setLoading, invalidatePaperTypesCache, invalidateTopicsCache, invalidateQuestionsCache]);

  const processMarkschemes = useCallback(async (subjectId: string, markschemes: File[]) => {
    const loadingKey = `process-markschemes-${subjectId}`;
    setLoading(loadingKey, true);

    try {
      // Get current subject to check if we have paper types
      const currentSubject = subjects.find(s => s.id === subjectId);
      if (!currentSubject) {
        throw new Error('Subject not found');
      }

      // Pre-process markschemes for storage
      const markschemesDataUris = await Promise.all(markschemes.map(file => fileToDataURI(file)));

      // Persist markschemes to database
      const dbMarkschemes: Markscheme[] = [];
      for (const markschemeFile of markschemes) {
        const markschemeContent = await fileToString(markschemeFile);

        // Save to database via API
        const response = await fetch(`/api/subjects/${subjectId}/markschemes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: markschemeFile.name,
            content: markschemeContent
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to save markscheme: ${markschemeFile.name}`);
        }

        const dbMarkscheme = await response.json();
        dbMarkschemes.push({
          id: dbMarkscheme.id.toString(),
          name: dbMarkscheme.name,
          content: dbMarkscheme.content,
        });
      }

      // Update local state with persisted markschemes
      setSubjects(prev => prev.map(s =>
        s.id === subjectId ? {
          ...s,
          markschemes: [...(s.markschemes || []), ...dbMarkschemes]
        } : s
      ));

      // Create Process M task and add it to the queue
      const processMId = `process-m-${subjectId}-${Date.now()}`;
      backgroundQueue.addTask({
        id: processMId,
        type: 'process_m',
        status: 'pending',
        displayName: 'P_M: Matching markschemes to questions...',
        subjectId,
        execute: async () => {
          // Fetch latest paper types with topics
          const response = await fetch(`/api/subjects/${subjectId}`);
          if (!response.ok) {
            throw new Error('Failed to fetch subject');
          }
          const apiSubject = await response.json();
          if (!apiSubject || !apiSubject.paperTypes || apiSubject.paperTypes.length === 0) {
            throw new Error('No paper types found for markscheme matching');
          }

          // Convert API format to client format
          const paperTypes = apiSubject.paperTypes.map((pt: any) => ({
            id: pt.id.toString(),
            name: pt.name,
            topics: (pt.topics || []).map((t: any) => ({
              id: t.id.toString(),
              name: t.name,
              description: t.description || '',
            }))
          }));

          // Call markscheme matching API endpoint
          console.log(`[Process M] Calling match-markschemes API with ${markschemesDataUris.length} markschemes`);

          const matchResponse = await fetch('/api/match-markschemes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subjectId,
              markschemesDataUris,
              paperTypes
            })
          });

          if (!matchResponse.ok) {
            const errorData = await matchResponse.json();
            throw new Error(`Markscheme matching failed: ${errorData.error || 'Unknown error'}`);
          }

          const matchResult = await matchResponse.json();
          console.log(`[Process M] Markscheme matching complete: ${matchResult.solutionsMatched} matched, ${matchResult.questionsUpdated} questions updated`);

          // Fetch updated subject from database to get questions with new solution objectives
          const subjectResponse = await fetch(`/api/subjects/${subjectId}`);
          if (!subjectResponse.ok) {
            throw new Error('Failed to fetch updated subject');
          }

          const updatedSubjectData = await subjectResponse.json();

          // Convert API format to client format
          const updatedPaperTypes = updatedSubjectData.paperTypes.map((pt: any) => ({
            id: pt.id.toString(),
            name: pt.name,
            topics: (pt.topics || []).map((t: any) => ({
              id: t.id.toString(),
              name: t.name,
              description: t.description || '',
              examQuestions: (t.examQuestions || []).map((q: any) => ({
                id: q.id.toString(),
                questionText: q.question_text,
                summary: q.summary,
                score: q.score || (q.attempts === 0 ? 50 : 0), // Default 50% if no attempts
                attempts: q.attempts || 0,
                solutionObjectives: q.solutionObjectives || undefined,
                completedObjectives: q.completedObjectives || [],
                paperDate: q.paperDate || null,
                questionNumber: q.questionNumber || null,
              }))
            }))
          }));

          // Update local state with the fresh data from database
          setSubjects(prev => prev.map(s => {
            if (s.id !== subjectId) return s;
            return {
              ...s,
              paperTypes: updatedPaperTypes
            };
          }));

          // Invalidate questions caches since solution objectives were added/updated
          updatedPaperTypes.forEach((pt: any) => {
            pt.topics.forEach((t: any) => {
              invalidateQuestionsCache(t.id);
              // Also invalidate full question cache for all questions in this topic
              t.examQuestions.forEach((q: any) => {
                invalidateFullQuestionCache(q.id);
              });
            });
          });

          toast({
            title: "Markschemes Matched",
            description: `Updated ${matchResult.questionsUpdated} questions with solution objectives from ${markschemes.length} markscheme(s).`
          });
        }
      });

      toast({
        title: "Markschemes Uploaded",
        description: `${markschemes.length} markscheme(s) uploaded. Starting matching to existing questions...`
      });

    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to process markschemes." });
    } finally {
      setLoading(loadingKey, false);
    }
  }, [subjects, toast, setLoading, invalidateQuestionsCache, invalidateFullQuestionCache]);

  const deleteSubject = useCallback(async (subjectId: string) => {
    try {
      const response = await fetch(`/api/subjects/${subjectId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete subject');
      }

      // Invalidate subjects cache - UI will reload automatically via cacheVersion
      invalidateSubjectsCache();
      toast({ title: "Success", description: "Subject deleted." });
    } catch (error) {
      console.error('Error deleting subject:', error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete subject." });
    }
  }, [toast, invalidateSubjectsCache]);

  const getSubjectById = useCallback((subjectId: string) => {
    return subjects.find(subject => subject.id === subjectId);
  }, [subjects]);
  
  const fileToDataURI = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const fileToString = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };


  const addPastPaperToSubject = useCallback(async (subjectId: string, paperFile: File) => {
    const loadingKey = `paper-${subjectId}`;
    setLoading(loadingKey, true);
    try {
      const paperContent = await fileToString(paperFile);

      // Persist to database via API
      const response = await fetch(`/api/subjects/${subjectId}/papers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: paperFile.name,
          content: paperContent
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save past paper to database');
      }

      const dbPaper = await response.json();
      const newPaper: PastPaper = {
        id: dbPaper.id.toString(),
        name: dbPaper.name,
        content: dbPaper.content,
      };

      // Update local state with persisted paper
      setSubjects(prevSubjects => prevSubjects.map(subject =>
        subject.id === subjectId ? { ...subject, pastPapers: [...subject.pastPapers, newPaper] } : subject
      ));
      toast({ title: "Past Paper Added", description: `"${paperFile.name}" has been uploaded.` });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Upload Error", description: "Failed to save past paper." });
    } finally {
      setLoading(loadingKey, false);
    }
  }, [toast, setLoading]);


  const updateExamQuestionScore = useCallback(async (subjectId: string, paperTypeName: string, topicName: string, questionId: string, score: number) => {
    try {
      // Persist score to database
      const response = await fetch(`/api/questions/${questionId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score })
      });

      if (!response.ok) {
        throw new Error('Failed to update score');
      }

      const updatedProgress = await response.json();

      // Update local state with the new score from the database
      setSubjects(prevSubjects => prevSubjects.map(subject => {
        if (subject.id !== subjectId) return subject;
        return {
          ...subject,
          paperTypes: subject.paperTypes.map(pt => {
            if (pt.name !== paperTypeName) return pt;
            return {
              ...pt,
              topics: pt.topics.map(topic => {
                if (topic.name !== topicName) return topic;
                return {
                  ...topic,
                  examQuestions: topic.examQuestions.map(question => {
                    if (question.id !== questionId) return question;

                    return {
                      ...question,
                      score: Math.round(updatedProgress.score * 10) / 10, // Round to 1 decimal place
                      attempts: updatedProgress.attempts
                    };
                  })
                };
              })
            }
          })
        };
      }));
    } catch (error) {
      console.error('Error updating score:', error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save score" });
    }
  }, [toast]);

  const generateQuestionVariant = useCallback(async (subjectId: string, paperTypeId: string, topicId: string, questionId: string): Promise<{ questionText: string; solutionObjectives: string[] }> => {
    // Find the question to generate a variant for
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) throw new Error('Subject not found');

    const paperType = subject.paperTypes.find(pt => pt.id === paperTypeId);
    if (!paperType) throw new Error('Paper type not found');

    const topic = paperType.topics.find(t => t.id === topicId);
    if (!topic) throw new Error('Topic not found');

    const question = topic.examQuestions.find(q => q.id === questionId);
    if (!question) throw new Error('Question not found');

    const hasObjectives = question.solutionObjectives && question.solutionObjectives.length > 0;

    if (hasObjectives) {
      console.log('[Process C] Generating similar question variant with adapted objectives...');
    } else {
      console.log('[Process C] Generating similar question variant WITHOUT markscheme (will manufacture objectives)...');
    }

    // Generate the variant directly (synchronously from the caller's perspective)
    const result = await generateSimilarQuestion({
      originalQuestionText: question.questionText,
      topicName: topic.name,
      topicDescription: topic.description,
      originalObjectives: question.solutionObjectives,
      originalDiagramMermaid: question.diagramMermaid,
    });

    console.log(`[Process C] Question variant generated successfully with ${result.solutionObjectives.length} ${hasObjectives ? 'adapted' : 'manufactured'} objectives`);

    return {
      questionText: result.questionText,
      solutionObjectives: result.solutionObjectives,
      diagramMermaid: result.diagramMermaid,
    };
  }, [subjects]);

  const addSubjectToWorkspace = useCallback(async (subjectId: string) => {
    try {
      const response = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add subject to workspace');
      }

      // Move subject from otherSubjects to subjects
      const subject = otherSubjects.find(s => s.id === subjectId);
      if (subject) {
        setOtherSubjects(prev => prev.filter(s => s.id !== subjectId));
        setSubjects(prev => [{ ...subject, isCreator: false }, ...prev]);
        // Invalidate subjects cache - UI will reload automatically via cacheVersion
        invalidateSubjectsCache();
        toast({ title: "Success", description: "Subject added to workspace" });
      }
    } catch (error: any) {
      console.error('Error adding subject to workspace:', error);
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  }, [otherSubjects, toast, invalidateSubjectsCache]);

  const removeSubjectFromWorkspace = useCallback(async (subjectId: string) => {
    try {
      const response = await fetch(`/api/workspace?subjectId=${subjectId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove subject from workspace');
      }

      // Invalidate subjects cache - UI will reload automatically via cacheVersion
      invalidateSubjectsCache();
      toast({ title: "Success", description: "Subject removed from workspace" });
    } catch (error: any) {
      console.error('Error removing subject from workspace:', error);
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  }, [toast, invalidateSubjectsCache]);

  const searchSubjects = useCallback(async (query: string) => {
    const loadingKey = 'search-subjects';
    setLoading(loadingKey, true);

    try {
      // Fetch subjects not in workspace with optional search query
      const url = query
        ? `/api/subjects?filter=other&search=${encodeURIComponent(query)}`
        : '/api/subjects?filter=other';

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to search subjects');
      }

      const apiOtherSubjects = await response.json();
      // Map lightweight search results (no full hierarchy)
      const clientOtherSubjects = apiOtherSubjects.map((sub: any) => ({
        id: sub.id.toString(),
        name: sub.name,
        syllabusContent: '',
        isCreator: false,
        pastPapers: [],
        paperTypes: [], // Empty - will be loaded on demand if user adds to workspace
        paperTypesCount: sub.paper_types_count || 0, // Store the count for display
      }));
      setOtherSubjects(clientOtherSubjects);
    } catch (error) {
      console.error('Error searching subjects:', error);
      toast({ variant: "destructive", title: "Error", description: "Failed to search subjects" });
    } finally {
      setLoading(loadingKey, false);
    }
  }, [toast, setLoading]);

  // NEW: Lazy loading functions
  const loadSubjectsList = useCallback(async (): Promise<SubjectPreview[]> => {
    // Return cached data if available
    if (subjectsListCache) {
      return subjectsListCache;
    }
    const loadingKey = 'load-subjects-list';
    setLoading(loadingKey, true);

    try {
      const response = await fetch('/api/subjects/list');
      if (!response.ok) {
        throw new Error('Failed to load subjects list');
      }

      const data = await response.json();
      const subjectsList: SubjectPreview[] = data.map((s: any) => ({
        id: s.id.toString(),
        name: s.name,
        paperTypesCount: s.paper_types_count,
        isCreator: s.is_creator === 1,
      }));

      // Cache the result
      setSubjectsListCache(subjectsList);

      return subjectsList;
    } catch (error) {
      console.error('Error loading subjects list:', error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load subjects" });
      throw error;
    } finally {
      setLoading(loadingKey, false);
    }
  }, [toast, setLoading]);

  const loadPaperTypes = useCallback(async (subjectId: string): Promise<PaperTypeWithMetrics[]> => {
    // Return cached data if available
    if (paperTypesCache[subjectId]) {
      return paperTypesCache[subjectId];
    }

    const loadingKey = `load-paper-types-${subjectId}`;
    setLoading(loadingKey, true);

    try {
      const response = await fetch(`/api/subjects/${subjectId}/paper-types`);
      if (!response.ok) {
        throw new Error('Failed to load paper types');
      }

      const data = await response.json();
      const paperTypes: PaperTypeWithMetrics[] = data.map((pt: any) => ({
        id: pt.id.toString(),
        name: pt.name,
        subject_id: pt.subject_id.toString(),
        total_questions: pt.total_questions,
        attempted_questions: pt.attempted_questions,
        avg_score: pt.avg_score,
      }));

      // Cache the result
      setPaperTypesCache(prev => ({ ...prev, [subjectId]: paperTypes }));

      return paperTypes;
    } catch (error) {
      console.error('Error loading paper types:', error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load paper types" });
      throw error;
    } finally {
      setLoading(loadingKey, false);
    }
  }, [toast, setLoading]);

  const loadTopics = useCallback(async (paperTypeId: string): Promise<TopicWithMetrics[]> => {
    // Return cached data if available
    if (topicsCache[paperTypeId]) {
      return topicsCache[paperTypeId];
    }

    const loadingKey = `load-topics-${paperTypeId}`;
    setLoading(loadingKey, true);

    try {
      const response = await fetch(`/api/paper-types/${paperTypeId}/topics`);
      if (!response.ok) {
        throw new Error('Failed to load topics');
      }

      const data = await response.json();
      const topics: TopicWithMetrics[] = data.map((t: any) => ({
        id: t.id.toString(),
        name: t.name,
        description: t.description || '',
        paper_type_id: t.paper_type_id.toString(),
        total_questions: t.total_questions,
        attempted_questions: t.attempted_questions,
        avg_score: t.avg_score,
      }));

      // Cache the result
      setTopicsCache(prev => ({ ...prev, [paperTypeId]: topics }));

      return topics;
    } catch (error) {
      console.error('Error loading topics:', error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load topics" });
      throw error;
    } finally {
      setLoading(loadingKey, false);
    }
  }, [toast, setLoading]);

  const loadQuestions = useCallback(async (topicId: string): Promise<QuestionPreview[]> => {
    // Return cached data if available
    if (questionsCache[topicId]) {
      return questionsCache[topicId];
    }

    const loadingKey = `load-questions-${topicId}`;
    setLoading(loadingKey, true);

    try {
      const response = await fetch(`/api/topics/${topicId}/questions`);
      if (!response.ok) {
        throw new Error('Failed to load questions');
      }

      const data = await response.json();
      const questions: QuestionPreview[] = data.map((q: any) => ({
        id: q.id.toString(),
        summary: q.summary,
        topic_id: q.topic_id.toString(),
        has_markscheme: q.has_markscheme,
        score: q.score,
        attempts: q.attempts,
      }));

      // Cache the result
      setQuestionsCache(prev => ({ ...prev, [topicId]: questions }));

      return questions;
    } catch (error) {
      console.error('Error loading questions:', error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load questions" });
      throw error;
    } finally {
      setLoading(loadingKey, false);
    }
  }, [toast, setLoading]);

  const loadFullQuestion = useCallback(async (questionId: string): Promise<FullQuestion> => {
    // Return cached data if available
    if (fullQuestionsCache[questionId]) {
      return fullQuestionsCache[questionId];
    }

    const loadingKey = `load-full-question-${questionId}`;
    setLoading(loadingKey, true);

    try {
      const response = await fetch(`/api/questions/${questionId}`);
      if (!response.ok) {
        throw new Error('Failed to load question');
      }

      const data = await response.json();
      const fullQuestion: FullQuestion = {
        id: data.id.toString(),
        topic_id: data.topic_id.toString(),
        question_text: data.question_text,
        summary: data.summary,
        solution_objectives: data.solution_objectives,
        diagram_mermaid: data.diagram_mermaid,
        markscheme_id: data.markscheme_id,
        paper_date: data.paper_date,
        question_number: data.question_number,
        categorization_confidence: data.categorization_confidence,
        categorization_reasoning: data.categorization_reasoning,
        score: data.score,
        attempts: data.attempts,
        completed_objectives: data.completed_objectives || [],
      };

      // Cache the result
      setFullQuestionsCache(prev => ({ ...prev, [questionId]: fullQuestion }));

      return fullQuestion;
    } catch (error) {
      console.error('Error loading full question:', error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load question" });
      throw error;
    } finally {
      setLoading(loadingKey, false);
    }
  }, [toast, setLoading]);

  return (
    <AppContext.Provider value={{
      subjects, otherSubjects, isLevel3User, cacheVersion,
      loadSubjectsList, loadPaperTypes, loadTopics, loadQuestions, loadFullQuestion,
      invalidateSubjectsCache, invalidatePaperTypesCache, invalidateTopicsCache, invalidateQuestionsCache, invalidateFullQuestionCache,
      createSubjectFromSyllabus, processExamPapers, processMarkschemes, deleteSubject, addSubjectToWorkspace, removeSubjectFromWorkspace, searchSubjects, getSubjectById, addPastPaperToSubject, updateExamQuestionScore, generateQuestionVariant, isLoading, setLoading
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

// Export types for use in components
export type { SubjectPreview, PaperTypeWithMetrics, TopicWithMetrics, QuestionPreview, FullQuestion };
