"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { Subject, Topic, Subsection, PastPaper, PaperType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { decomposeSyllabus } from '@/ai/flows/decompose-syllabus-into-topics';

interface AppContextType {
  subjects: Subject[];
  createSubjectFromSyllabus: (syllabusFile: File) => Promise<void>;
  deleteSubject: (subjectId: string) => void;
  getSubjectById: (subjectId: string) => Subject | undefined;
  addPastPaperToSubject: (subjectId: string, paperFile: File) => Promise<void>;
  updateSubsectionScore: (subjectId: string, paperTypeName: string, topicName: string, subsectionName: string, score: number) => void;
  isLoading: (key: string) => boolean;
  setLoading: (key: string, value: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedSubjects = localStorage.getItem('examplify-ai-subjects');
      if (storedSubjects) {
        const parsed = JSON.parse(storedSubjects);
        // Migration: Add attempts field to existing subsections if missing
        const migrated = parsed.map((subject: Subject) => ({
          ...subject,
          paperTypes: subject.paperTypes.map(pt => ({
            ...pt,
            topics: pt.topics.map(topic => ({
              ...topic,
              subsections: topic.subsections.map(sub => ({
                ...sub,
                attempts: sub.attempts ?? 0, // Add attempts if missing
              }))
            }))
          }))
        }));
        setSubjects(migrated);
      }
    } catch (error) {
      console.error("Failed to load subjects from localStorage", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load your saved data." });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('examplify-ai-subjects', JSON.stringify(subjects));
    } catch (error) {
      console.error("Failed to save subjects to localStorage", error);
    }
  }, [subjects]);

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

      const result = await decomposeSyllabus({ syllabusDataUri });

      const newPaperTypes: PaperType[] = (result.paperTypes || []).map(pt => ({
        id: pt.name.toLowerCase().replace(/\s+/g, '-'),
        name: pt.name,
        topics: (pt.topics || []).map(topic => ({
          id: topic.name.toLowerCase().replace(/\s+/g, '-'),
          name: topic.name,
          subsections: (topic.subsections || []).map(subsectionName => ({
            id: subsectionName.toLowerCase().replace(/\s+/g, '-'),
            name: subsectionName,
            score: 0,
            attempts: 0,
          })),
        })),
      }));

      const newSubject: Subject = {
        id: Date.now().toString(),
        name: result.subjectName || 'Untitled Subject',
        syllabusContent: syllabusText,
        pastPapers: [],
        paperTypes: newPaperTypes,
      };

      setSubjects(prev => [...prev, newSubject]);
      toast({ title: "Subject Created", description: `"${newSubject.name}" with ${newPaperTypes.length} paper types.` });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "AI Error", description: "Failed to process syllabus." });
    } finally {
      setLoading(loadingKey, false);
    }
  }, [toast, setLoading]);

  const deleteSubject = useCallback((subjectId: string) => {
    setSubjects(prev => prev.filter(subject => subject.id !== subjectId));
    toast({ title: "Success", description: "Subject deleted." });
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


  const updateSubsectionScore = useCallback((subjectId: string, paperTypeName: string, topicName: string, subsectionName: string, score: number) => {
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
                subsections: topic.subsections.map(sub => {
                  if (sub.name !== subsectionName) return sub;

                  // The score from the AI is out of 10
                  // We treat scoring as an average, starting with an imaginary initial 0/10 score
                  // Formula: new_percentage = (old_percentage * (n + 1) + score * 10) / (n + 2)
                  const n = sub.attempts || 0;
                  const oldPercentage = sub.score || 0;
                  const newPercentage = (oldPercentage * (n + 1) + score * 10) / (n + 2);

                  return {
                    ...sub,
                    score: Math.round(newPercentage * 10) / 10, // Round to 1 decimal place
                    attempts: n + 1
                  };
                })
              };
            })
          }
        })
      };
    }));
  }, []);

  return (
    <AppContext.Provider value={{ subjects, createSubjectFromSyllabus, deleteSubject, getSubjectById, addPastPaperToSubject, updateSubsectionScore, isLoading, setLoading }}>
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
