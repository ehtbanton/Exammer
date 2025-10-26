"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import type { Subject, Topic, ExamQuestion, PastPaper, PaperType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { decomposeSyllabus } from '@/ai/flows/decompose-syllabus-into-topics';
import { extractExamQuestions } from '@/ai/flows/extract-exam-questions';
import { generateSimilarQuestion } from '@/ai/flows/generate-similar-question';
import { backgroundQueue } from '@/lib/background-queue';

interface AppContextType {
  subjects: Subject[];
  otherSubjects: Subject[];
  createSubjectFromSyllabus: (syllabusFile: File) => Promise<void>;
  processExamPapers: (subjectId: string, examPapers: File[]) => Promise<void>;
  deleteSubject: (subjectId: string) => Promise<void>;
  addSubjectToWorkspace: (subjectId: string) => Promise<void>;
  removeSubjectFromWorkspace: (subjectId: string) => Promise<void>;
  getSubjectById: (subjectId: string) => Subject | undefined;
  addPastPaperToSubject: (subjectId: string, paperFile: File) => Promise<void>;
  updateExamQuestionScore: (subjectId: string, paperTypeName: string, topicName: string, questionId: string, score: number) => void;
  generateQuestionVariant: (subjectId: string, paperTypeId: string, topicId: string, questionId: string) => Promise<string>;
  isLoading: (key: string) => boolean;
  setLoading: (key: string, value: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [otherSubjects, setOtherSubjects] = useState<Subject[]>([]);
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
        return;
      }

      try {
        // Fetch workspace subjects
        const workspaceResponse = await fetch('/api/subjects');
        if (workspaceResponse.ok) {
          const apiSubjects = await workspaceResponse.json();
          const clientSubjects = apiSubjects.map((sub: any) => ({
            id: sub.id.toString(),
            name: sub.name,
            syllabusContent: sub.syllabus_content || '',
            isCreator: sub.is_creator === 1,
            pastPapers: (sub.pastPapers || []).map((pp: any) => ({
              id: pp.id.toString(),
              name: pp.name,
              content: pp.content
            })),
            paperTypes: (sub.paperTypes || []).map((pt: any) => ({
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
                  score: q.score || 0,
                  attempts: q.attempts || 0,
                }))
              }))
            }))
          }));
          setSubjects(clientSubjects);
        }

        // Fetch other subjects (not in workspace)
        const otherResponse = await fetch('/api/subjects?filter=other');
        if (otherResponse.ok) {
          const apiOtherSubjects = await otherResponse.json();
          const clientOtherSubjects = apiOtherSubjects.map((sub: any) => ({
            id: sub.id.toString(),
            name: sub.name,
            syllabusContent: sub.syllabus_content || '',
            isCreator: false,
            pastPapers: (sub.pastPapers || []).map((pp: any) => ({
              id: pp.id.toString(),
              name: pp.name,
              content: pp.content
            })),
            paperTypes: (sub.paperTypes || []).map((pt: any) => ({
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
                  score: q.score || 0,
                  attempts: q.attempts || 0,
                }))
              }))
            }))
          }));
          setOtherSubjects(clientOtherSubjects);
        }
      } catch (error) {
        console.error("Failed to fetch subjects:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to load subjects" });
      }
    };

    // Only fetch when session status is authenticated
    if (status === 'authenticated') {
      fetchSubjects();
    } else if (status === 'unauthenticated') {
      setSubjects([]);
      setOtherSubjects([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, status]);

  const setLoading = useCallback((key: string, value: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  }, []);

  const isLoading = useCallback((key: string) => !!loadingStates[key], [loadingStates]);

  const createSubjectFromSyllabus = useCallback(async (syllabusFile: File) => {
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

      // Create placeholder subject in local state
      const placeholderSubject: Subject = {
        id: subjectId,
        name: 'Processing...',
        syllabusContent: syllabusText,
        pastPapers: [],
        paperTypes: [],
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
          await fetch(`/api/subjects/${subjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: result.subjectName || 'Untitled Subject' })
          });

          // Create paper types in database and get their IDs
          const createdPaperTypes: PaperType[] = [];
          for (const pt of result.paperTypes || []) {
            const ptResponse = await fetch(`/api/subjects/${subjectId}/paper-types`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: pt.name })
            });
            const dbPaperType = await ptResponse.json();

            // Create topics for this paper type
            const createdTopics = [];
            for (const topic of pt.topics || []) {
              const topicResponse = await fetch(`/api/paper-types/${dbPaperType.id}/topics`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: topic.name, description: topic.description })
              });
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

    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to start syllabus processing." });
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

      const pastPapers: PastPaper[] = [];
      for (const paperFile of examPapers) {
        const paperContent = await fileToString(paperFile);
        pastPapers.push({
          id: Date.now().toString() + Math.random(),
          name: paperFile.name,
          content: paperContent,
        });
      }

      // Store past papers immediately
      setSubjects(prev => prev.map(s =>
        s.id === subjectId ? { ...s, pastPapers: [...s.pastPapers, ...pastPapers] } : s
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

          // Extract questions from all papers
          const topicsInfo = paperTypes.flatMap(pt =>
            pt.topics.map(t => ({ name: t.name, description: t.description }))
          );

          if (topicsInfo.length === 0) {
            throw new Error('No topics found for question extraction');
          }

          const paperTypesInfo = paperTypes.map(pt => ({ name: pt.name }));

          // Process each exam paper individually
          const allExtractedQuestions: Array<{ paperTypeName: string; questionText: string; summary: string; topicName: string }> = [];

          for (let i = 0; i < examPapersDataUris.length; i++) {
            const questionsResult = await extractExamQuestions({
              examPaperDataUri: examPapersDataUris[i],
              paperTypes: paperTypesInfo,
              topics: topicsInfo,
            });

            // Add paper type info to each question for later categorization
            questionsResult.questions.forEach(q => {
              allExtractedQuestions.push({
                paperTypeName: questionsResult.paperTypeName,
                questionText: q.questionText,
                summary: q.summary,
                topicName: q.topicName,
              });
            });
          }

          // Persist questions to database and update subject with questions
          const updatedPaperTypes = await Promise.all(paperTypes.map(async (pt) => {
            const updatedTopics = await Promise.all(pt.topics.map(async (topic) => {
              // Filter questions that belong to this paper type AND this topic
              const topicQuestions = allExtractedQuestions.filter(
                q => q.paperTypeName === pt.name && q.topicName === topic.name
              );

              // Persist each question to the database
              const createdQuestions = await Promise.all(topicQuestions.map(async (q) => {
                const response = await fetch(`/api/topics/${topic.id}/questions`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    questionText: q.questionText,
                    summary: q.summary
                  })
                });
                const dbQuestion = await response.json();
                return {
                  id: dbQuestion.id.toString(),
                  questionText: dbQuestion.question_text,
                  summary: dbQuestion.summary,
                  score: 0,
                  attempts: 0,
                };
              }));

              return {
                ...topic,
                examQuestions: [...topic.examQuestions, ...createdQuestions],
              };
            }));

            return {
              ...pt,
              topics: updatedTopics
            };
          }));

          // Update local state with the created questions
          setSubjects(prev => prev.map(s => {
            if (s.id !== subjectId) return s;
            return {
              ...s,
              paperTypes: updatedPaperTypes
            };
          }));

          toast({
            title: "Questions Extracted",
            description: `Extracted ${allExtractedQuestions.length} questions from ${examPapers.length} paper(s).`
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
  }, [subjects, toast, setLoading]);

  const deleteSubject = useCallback(async (subjectId: string) => {
    try {
      const response = await fetch(`/api/subjects/${subjectId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete subject');
      }

      setSubjects(prev => prev.filter(subject => subject.id !== subjectId));
      toast({ title: "Success", description: "Subject deleted." });
    } catch (error) {
      console.error('Error deleting subject:', error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete subject." });
    }
  }, [toast]);

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
      const newPaper: PastPaper = {
        id: Date.now().toString(),
        name: paperFile.name,
        content: paperContent,
      };
      setSubjects(prevSubjects => prevSubjects.map(subject =>
        subject.id === subjectId ? { ...subject, pastPapers: [...subject.pastPapers, newPaper] } : subject
      ));
      toast({ title: "Past Paper Added", description: `"${paperFile.name}" has been uploaded.` });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Upload Error", description: "Failed to read past paper." });
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

  const generateQuestionVariant = useCallback(async (subjectId: string, paperTypeId: string, topicId: string, questionId: string): Promise<string> => {
    // Find the question to generate a variant for
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) throw new Error('Subject not found');

    const paperType = subject.paperTypes.find(pt => pt.id === paperTypeId);
    if (!paperType) throw new Error('Paper type not found');

    const topic = paperType.topics.find(t => t.id === topicId);
    if (!topic) throw new Error('Topic not found');

    const question = topic.examQuestions.find(q => q.id === questionId);
    if (!question) throw new Error('Question not found');

    console.log('[Process C] Generating similar question variant...');

    // Generate the variant directly (synchronously from the caller's perspective)
    const result = await generateSimilarQuestion({
      originalQuestionText: question.questionText,
      topicName: topic.name,
      topicDescription: topic.description,
    });

    console.log('[Process C] Question variant generated successfully');

    return result.questionText;
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
        toast({ title: "Success", description: "Subject added to workspace" });
      }
    } catch (error: any) {
      console.error('Error adding subject to workspace:', error);
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  }, [otherSubjects, toast]);

  const removeSubjectFromWorkspace = useCallback(async (subjectId: string) => {
    try {
      const response = await fetch(`/api/workspace?subjectId=${subjectId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove subject from workspace');
      }

      // Move subject from subjects to otherSubjects
      const subject = subjects.find(s => s.id === subjectId);
      if (subject) {
        setSubjects(prev => prev.filter(s => s.id !== subjectId));
        setOtherSubjects(prev => [{ ...subject, isCreator: false }, ...prev]);
        toast({ title: "Success", description: "Subject removed from workspace" });
      }
    } catch (error: any) {
      console.error('Error removing subject from workspace:', error);
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  }, [subjects, toast]);

  return (
    <AppContext.Provider value={{ subjects, otherSubjects, createSubjectFromSyllabus, processExamPapers, deleteSubject, addSubjectToWorkspace, removeSubjectFromWorkspace, getSubjectById, addPastPaperToSubject, updateExamQuestionScore, generateQuestionVariant, isLoading, setLoading }}>
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
