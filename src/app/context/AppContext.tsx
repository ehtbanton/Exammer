"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { Exam, Topic, Subsection, PastPaper } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { decomposeSyllabusIntoTopics } from '@/ai/flows/decompose-syllabus-into-topics';
import { generateGranularSubsections } from '@/ai/flows/generate-granular-subsections';

interface AppContextType {
  exams: Exam[];
  addExam: (name: string) => void;
  deleteExam: (examId: string) => void;
  getExamById: (examId: string) => Exam | undefined;
  addSyllabusToExam: (examId: string, syllabusFile: File) => Promise<void>;
  addPastPaperToExam: (examId: string, paperFile: File) => Promise<void>;
  setSubsectionsForTopic: (examId: string, topicName: string) => Promise<void>;
  updateSubsectionScore: (examId: string, topicName: string, subsectionName: string, score: number) => void;
  isLoading: (key: string) => boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedExams = localStorage.getItem('examplify-ai-exams');
      if (storedExams) {
        setExams(JSON.parse(storedExams));
      }
    } catch (error) {
      console.error("Failed to load exams from localStorage", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load your saved data." });
    }
  }, [toast]);

  useEffect(() => {
    try {
      localStorage.setItem('examplify-ai-exams', JSON.stringify(exams));
    } catch (error) {
      console.error("Failed to save exams to localStorage", error);
    }
  }, [exams]);

  const setLoading = (key: string, value: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  };
  const isLoading = (key: string) => !!loadingStates[key];

  const addExam = (name: string) => {
    const newExam: Exam = {
      id: Date.now().toString(),
      name,
      syllabusContent: null,
      pastPapers: [],
      topics: [],
    };
    setExams(prev => [...prev, newExam]);
    toast({ title: "Success", description: `Exam "${name}" created.` });
  };

  const deleteExam = (examId: string) => {
    setExams(prev => prev.filter(exam => exam.id !== examId));
    toast({ title: "Success", description: "Exam deleted." });
  };

  const getExamById = (examId: string) => {
    return exams.find(exam => exam.id === examId);
  };
  
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

  const addSyllabusToExam = useCallback(async (examId: string, syllabusFile: File) => {
    const loadingKey = `syllabus-${examId}`;
    setLoading(loadingKey, true);
    try {
      const syllabusDataUri = await fileToDataURI(syllabusFile);
      const syllabusText = await fileToString(syllabusFile);

      const result = await decomposeSyllabusIntoTopics({ syllabusDataUri });
      
      const newTopics: Topic[] = result.topics.map(topicName => ({
        id: topicName.toLowerCase().replace(/\s+/g, '-'),
        name: topicName,
        subsections: [],
      }));

      setExams(prevExams => prevExams.map(exam => 
        exam.id === examId ? { ...exam, topics: newTopics, syllabusContent: syllabusText } : exam
      ));
      toast({ title: "Syllabus Processed", description: `${result.topics.length} topics identified.` });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "AI Error", description: "Failed to process syllabus." });
    } finally {
      setLoading(loadingKey, false);
    }
  }, [toast]);

  const addPastPaperToExam = useCallback(async (examId: string, paperFile: File) => {
    const loadingKey = `paper-${examId}`;
    setLoading(loadingKey, true);
    try {
      const paperContent = await fileToString(paperFile);
      const newPaper: PastPaper = {
        id: Date.now().toString(),
        name: paperFile.name,
        content: paperContent,
      };
      setExams(prevExams => prevExams.map(exam =>
        exam.id === examId ? { ...exam, pastPapers: [...exam.pastPapers, newPaper] } : exam
      ));
      toast({ title: "Past Paper Added", description: `"${paperFile.name}" has been uploaded.` });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Upload Error", description: "Failed to read past paper." });
    } finally {
      setLoading(loadingKey, false);
    }
  }, [toast]);

  const setSubsectionsForTopic = useCallback(async (examId: string, topicName: string) => {
    const exam = exams.find(e => e.id === examId);
    if (!exam || !exam.syllabusContent) return;

    const loadingKey = `subsections-${examId}-${topicName}`;
    setLoading(loadingKey, true);
    try {
      const result = await generateGranularSubsections({
        topic: topicName,
        examSyllabus: exam.syllabusContent,
        pastPapers: exam.pastPapers.map(p => p.content),
      });

      const newSubsections: Subsection[] = result.subsections.map(subName => ({
        id: subName.toLowerCase().replace(/\s+/g, '-'),
        name: subName,
        score: 0,
      }));

      setExams(prevExams => prevExams.map(e => 
        e.id === examId ? {
          ...e,
          topics: e.topics.map(t => 
            t.name === topicName ? { ...t, subsections: newSubsections } : t
          )
        } : e
      ));
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "AI Error", description: "Failed to generate subsections." });
    } finally {
      setLoading(loadingKey, false);
    }
  }, [exams, toast]);

  const updateSubsectionScore = useCallback((examId: string, topicName: string, subsectionName: string, score: number) => {
    setExams(prevExams => prevExams.map(exam => {
      if (exam.id !== examId) return exam;
      return {
        ...exam,
        topics: exam.topics.map(topic => {
          if (topic.name !== topicName) return topic;
          return {
            ...topic,
            subsections: topic.subsections.map(sub => {
              if (sub.name !== subsectionName) return sub;
              const newScore = Math.min(100, sub.score + score);
              return { ...sub, score: newScore };
            })
          };
        })
      };
    }));
  }, []);

  return (
    <AppContext.Provider value={{ exams, addExam, deleteExam, getExamById, addSyllabusToExam, addPastPaperToExam, setSubsectionsForTopic, updateSubsectionScore, isLoading }}>
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
