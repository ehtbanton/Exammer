"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext } from '@/app/context/AppContext';
import { AuthGuard } from '@/components/AuthGuard';
import { aiPoweredInterview } from '@/ai/flows/ai-powered-interview';
import { generateSimilarQuestion } from '@/ai/flows/generate-similar-question';
import { executeDevCommand } from '@/ai/flows/dev-commands';
import { isDevCommand } from '@/lib/dev-commands-helpers';
import type { ChatHistory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import LoadingSpinner from '@/components/LoadingSpinner';
import { ArrowLeft } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import PageSpinner from '@/components/PageSpinner';
import { WhiteboardStudio, FinishQuestionDialog } from '@/components/whiteboard-studio';
import 'tldraw/tldraw.css';
import { AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';

export default function InterviewPage() {
  return (
    <AuthGuard>
      <InterviewPageContent />
    </AuthGuard>
  );
}

function InterviewPageContent() {
  const params = useParams();
  const router = useRouter();
  const { updateExamQuestionScore, loadFullQuestion, loadSubjectsList, loadPaperTypes, loadTopics, isLoading: isAppLoading, cacheVersion } = useAppContext();
  const { toast } = useToast();
  const { data: session, status } = useSession();

  const subjectId = params.subjectId as string;
  const paperTypeId = decodeURIComponent(params.paperTypeId as string);
  const topicId = decodeURIComponent(params.topicId as string);
  const questionId = decodeURIComponent(params.questionId as string);

  const [subject, setSubject] = useState<import('@/app/context/AppContext').SubjectPreview | null>(null);
  const [paperType, setPaperType] = useState<import('@/app/context/AppContext').PaperTypeWithMetrics | null>(null);
  const [topic, setTopic] = useState<import('@/app/context/AppContext').TopicWithMetrics | null>(null);
  const [examQuestion, setExamQuestion] = useState<import('@/app/context/AppContext').FullQuestion | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatHistory>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generatedVariant, setGeneratedVariant] = useState<{questionText: string; solutionObjectives: string[]; diagramDescription?: string} | null>(null);
  const [accessLevel, setAccessLevel] = useState<number | null>(null);
  const [completedObjectives, setCompletedObjectives] = useState<number[]>([]);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [noMarkscheme, setNoMarkscheme] = useState(false);
  const [showCacheLimitWarning, setShowCacheLimitWarning] = useState(false);
  const [oldestCachedQuestion, setOldestCachedQuestion] = useState<{id: string; timestamp: number} | null>(null);
  const [pendingQuestionGeneration, setPendingQuestionGeneration] = useState<(() => Promise<void>) | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [isWhiteboardStudio, setIsWhiteboardStudio] = useState(false);

  // Cache management functions
  const CACHE_KEY = 'question-progress-cache';
  const MAX_CACHED_QUESTIONS = 5;

  const getQuestionCache = () => {
    const cache = localStorage.getItem(CACHE_KEY);
    return cache ? JSON.parse(cache) : {};
  };

  const saveToCache = (questionId: string, data: any) => {
    const cache = getQuestionCache();
    cache[questionId] = { ...data, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  };

  const removeFromCache = (questionId: string) => {
    const cache = getQuestionCache();
    delete cache[questionId];
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  };

  const getOldestCachedQuestion = () => {
    const cache = getQuestionCache();
    const entries = Object.entries(cache);
    if (entries.length === 0) return null;

    let oldest = entries[0];
    for (const entry of entries) {
      if ((entry[1] as any).timestamp < (oldest[1] as any).timestamp) {
        oldest = entry;
      }
    }
    return { id: oldest[0], timestamp: (oldest[1] as any).timestamp };
  };

  const canAddToCache = () => {
    const cache = getQuestionCache();
    return Object.keys(cache).length < MAX_CACHED_QUESTIONS;
  };

  // Conversation storage helpers
  const createConversation = async (qId: number): Promise<number | null> => {
    console.log('Creating conversation for question ID:', qId);
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: qId }),
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Created conversation:', data.id);
        return data.id;
      } else {
        const errorText = await response.text();
        console.error('Failed to create conversation, status:', response.status, 'response:', errorText);
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
    return null;
  };

  const saveMessage = async (convId: number, role: 'user' | 'assistant', content: string, imageUrl?: string) => {
    try {
      const response = await fetch(`/api/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content, imageUrl }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to save message, status:', response.status, errorText);
      }
    } catch (error) {
      console.error('Failed to save message:', error);
    }
  };

  const completeConversation = async (convId: number, score: number, objectives: string[]) => {
    console.log('Completing conversation:', convId, 'score:', score, 'objectives:', objectives.length);
    try {
      const response = await fetch(`/api/conversations/${convId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalScore: score, completedObjectives: objectives }),
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Conversation completed successfully:', data);
      } else {
        const errorText = await response.text();
        console.error('Failed to complete conversation, status:', response.status, 'response:', errorText);
      }
    } catch (error) {
      console.error('Failed to complete conversation:', error);
    }
  };

  // Load subject, paper type, topic, and full question on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load subject
        const subjectsList = await loadSubjectsList();
        const foundSubject = subjectsList.find(s => s.id === subjectId);
        setSubject(foundSubject || null);

        // Load paper types and find the one we need
        if (foundSubject) {
          const paperTypesList = await loadPaperTypes(subjectId);
          const foundPaperType = paperTypesList.find(pt => pt.id === paperTypeId);
          setPaperType(foundPaperType || null);

          // Load topics and find the one we need
          if (foundPaperType) {
            const topicsList = await loadTopics(paperTypeId);
            const foundTopic = topicsList.find(t => t.id === topicId);
            setTopic(foundTopic || null);
          }
        }

        // Load full question
        const fullQuestion = await loadFullQuestion(questionId);
        setExamQuestion(fullQuestion);
      } catch (error) {
        console.error('Error loading question data:', error);
        toast({ variant: "destructive", title: "Error", description: "Failed to load question" });
      }
    };

    loadData();
  }, [questionId, subjectId, paperTypeId, topicId, loadFullQuestion, loadSubjectsList, loadPaperTypes, loadTopics, toast, cacheVersion]);

  const hasInitialized = useRef<string | false>(false);
  const isInitializing = useRef(false);

  // Fetch user access level
  useEffect(() => {
    if (status === 'authenticated') {
      const fetchAccessLevel = async () => {
        try {
          const response = await fetch('/api/auth/access-level');
          if (response.ok) {
            const data = await response.json();
            setAccessLevel(data.accessLevel);
          }
        } catch (error) {
          console.error('Failed to fetch access level:', error);
        }
      };
      fetchAccessLevel();
    }
  }, [status]);

  // Auto-save progress to cache whenever objectives are completed
  useEffect(() => {
    // Only save if we have a generated variant and some progress
    if (generatedVariant && chatHistory.length > 1) {
      saveToCache(questionId, {
        variant: generatedVariant,
        chatHistory,
        completedObjectives,
      });
      console.log('Auto-saved progress to cache:', completedObjectives.length, 'objectives completed');
    }
  }, [completedObjectives, chatHistory, generatedVariant, questionId]);

  useEffect(() => {
    console.log('=== useEffect triggered ===', { questionId: examQuestion?.id });

    if (!examQuestion) {
      console.log('Early return - no exam question loaded yet');
      return;
    }

    // Create a unique key for this question to track if we've already initialized
    const questionKey = `${questionId}`;

    // Check both if we've already initialized AND if we're currently initializing
    if (hasInitialized.current === questionKey) {
      console.log('Already initialized for this question, skipping');
      return;
    }

    if (isInitializing.current) {
      console.log('Already initializing, skipping duplicate call');
      return;
    }

    const generateNewQuestion = async () => {
      console.log('Generating question variant with adapted objectives...');
      const variantData = await generateSimilarQuestion({
        originalQuestionText: examQuestion.question_text,
        topicName: '', // Not used in variant generation
        topicDescription: '', // Not used in variant generation
        originalObjectives: examQuestion.solution_objectives,
        originalDiagramDescription: examQuestion.diagram_description,
      });
      setGeneratedVariant(variantData);
      console.log('Question variant generated successfully with', variantData.solutionObjectives.length, 'objectives');

      // Create a conversation record for RAG search
      const convId = await createConversation(parseInt(examQuestion.id));
      if (convId) {
        setConversationId(convId);
      }

      // Start the interview with the generated variant and objectives
      console.log('Calling aiPoweredInterview with generated variant and objectives...');
      const res = await aiPoweredInterview({
        subsection: examQuestion.summary,
        question: variantData.questionText,
        solutionObjectives: variantData.solutionObjectives,
        previouslyCompletedObjectives: [],
      });
      console.log('Interview started, chat history:', res.chatHistory);
      setChatHistory(res.chatHistory);
      setCompletedObjectives(res.completedObjectives || []);

      // Save the initial assistant message to the conversation
      if (convId && res.chatHistory.length > 0) {
        const firstMsg = res.chatHistory[0];
        if (firstMsg.role === 'assistant') {
          saveMessage(convId, 'assistant', firstMsg.content);
        }
      }
    };

    const startInterview = async () => {
      console.log('Starting interview...');
      isInitializing.current = true;
      hasInitialized.current = questionKey;
      setIsLoading(true);
      try {
        // Check if there's cached progress for this question
        const cache = getQuestionCache();
        const cachedData = cache[questionId];

        if (cachedData) {
          console.log('Found cached progress, restoring...');
          setGeneratedVariant(cachedData.variant);
          setChatHistory(cachedData.chatHistory);
          setCompletedObjectives(cachedData.completedObjectives);
          console.log('Restored in-progress question with', cachedData.completedObjectives.length, 'completed objectives');

          // Create a conversation for the restored session (for RAG search)
          const convId = await createConversation(parseInt(examQuestion.id));
          if (convId) {
            setConversationId(convId);
            // Save all existing messages to the conversation
            for (const msg of cachedData.chatHistory) {
              await saveMessage(convId, msg.role, msg.content, msg.imageUrl);
            }
          }

          // Auto-launch WhiteboardStudio after cache restoration
          setIsWhiteboardStudio(true);
        } else {
          // Check if cache is full before generating new question
          if (!canAddToCache()) {
            const oldest = getOldestCachedQuestion();
            setOldestCachedQuestion(oldest);
            setPendingQuestionGeneration(() => generateNewQuestion);
            setShowCacheLimitWarning(true);
            setIsLoading(false);
            isInitializing.current = false;
            return;
          }

          await generateNewQuestion();

          // Auto-launch WhiteboardStudio after question generation
          setIsWhiteboardStudio(true);
        }
      } catch (e: any) {
        if (e.message?.includes('no solution objectives')) {
          setNoMarkscheme(true);
          toast({ variant: 'destructive', title: 'No Markscheme', description: 'This question has no markscheme objectives.' });
        } else {
          toast({ variant: 'destructive', title: 'AI Error', description: 'Could not start the interview.' });
        }
        console.error(e);
        hasInitialized.current = false; // Reset on error so user can retry
      } finally {
        setIsLoading(false);
        isInitializing.current = false;
      }
    };
    startInterview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examQuestion?.id, toast]);

  const handleVoiceMessage = (role: 'user' | 'assistant', content: string) => {
    setChatHistory(prev => [...prev, { role, content }]);
  };

  const handleVoiceEvaluation = async (userAnswer: string) => {
    if (!generatedVariant || !examQuestion) return;

    try {
      console.log('Evaluating voice answer against objectives...');

      // Call aiPoweredInterview with the voice transcription
      // Note: We don't update chatHistory here - VoiceInterviewLive already handles that
      const res = await aiPoweredInterview({
        subsection: examQuestion.summary,
        userAnswer,
        previousChatHistory: chatHistory,
        question: generatedVariant.questionText,
        solutionObjectives: generatedVariant.solutionObjectives,
        previouslyCompletedObjectives: completedObjectives,
      });

      // Update objectives (merge with existing)
      setCompletedObjectives(prevCompleted => {
        const newSet = new Set([...prevCompleted, ...res.completedObjectives]);
        const updated = Array.from(newSet).sort((a, b) => a - b);
        console.log('Objectives updated from voice:', {
          previous: prevCompleted,
          new: res.completedObjectives,
          merged: updated
        });
        return updated;
      });
    } catch (e) {
      console.error('Voice evaluation error:', e);
      // Don't show toast for voice errors - evaluation happens in background
    }
  };

  const handleSendMessage = async (content?: string, imageData?: string) => {
    // Use provided content or fall back to userInput state
    const messageContent = content ?? userInput;

    if ((!messageContent.trim() && !imageData) || !subject || !examQuestion || isLoading || !generatedVariant) return;

    setIsLoading(true);
    const currentInput = messageContent;
    if (!content) setUserInput(''); // Only clear userInput if we used it

    // Check if this is a cheat command (level 2+ users only)
    if (accessLevel !== null && accessLevel >= 2 && !imageData && isDevCommand(currentInput)) {
      try {
        toast({
          title: "Cheat Command Detected",
          description: `Executing: ${currentInput}`,
        });

        const devResult = await executeDevCommand({
          command: currentInput,
          question: generatedVariant.questionText,
          subsection: examQuestion.summary,
          solutionObjectives: generatedVariant.solutionObjectives,
          completedObjectives: completedObjectives,
        });

        // Add the generated answer as a user message
        const newHistoryWithDevAnswer: ChatHistory = [...chatHistory, {
          role: 'user',
          content: devResult.generatedAnswer,
        }];
        setChatHistory(newHistoryWithDevAnswer);

        // Now send this generated answer to the interview AI
        const res = await aiPoweredInterview({
          subsection: examQuestion.summary,
          userAnswer: devResult.generatedAnswer,
          previousChatHistory: chatHistory,
          question: generatedVariant.questionText,
          solutionObjectives: generatedVariant.solutionObjectives,
          previouslyCompletedObjectives: completedObjectives,
        });

        setChatHistory(res.chatHistory);
        setCompletedObjectives(res.completedObjectives || []);
      } catch (e) {
        toast({ variant: 'destructive', title: 'Cheat Command Error', description: 'Failed to execute cheat command.' });
        console.error(e);
        setChatHistory(chatHistory);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Normal message handling
    const newHistory: ChatHistory = [...chatHistory, {
      role: 'user',
      content: currentInput || 'Whiteboard drawing',
      imageUrl: imageData,
    }];
    setChatHistory(newHistory);

    // Save user message to conversation
    if (conversationId) {
      saveMessage(conversationId, 'user', currentInput || 'Whiteboard drawing', imageData);
    }

    try {
      const res = await aiPoweredInterview({
        subsection: examQuestion.summary,
        userAnswer: currentInput || undefined,
        userImage: imageData,
        previousChatHistory: chatHistory,
        question: generatedVariant.questionText,
        solutionObjectives: generatedVariant.solutionObjectives,
        previouslyCompletedObjectives: completedObjectives,
      });

      setChatHistory(res.chatHistory);
      // Ensure immutability - merge new objectives with existing ones
      setCompletedObjectives(prevCompleted => {
        const newSet = new Set([...prevCompleted, ...res.completedObjectives]);
        return Array.from(newSet).sort((a, b) => a - b);
      });

      // Save assistant response to conversation
      if (conversationId && res.chatHistory.length > 0) {
        const lastMsg = res.chatHistory[res.chatHistory.length - 1];
        if (lastMsg.role === 'assistant') {
          saveMessage(conversationId, 'assistant', lastMsg.content);
        }
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'AI Error', description: 'Could not get AI response.' });
      console.error('AI Interview Error:', e);
      // Keep the user message but add an error response instead of reverting
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error analyzing your work. Please try again.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!subject || !topic || !examQuestion) {
    // Show loading while subjects are being fetched OR while generating question
    if (isLoading || isAppLoading('fetch-subjects')) return <PageSpinner />;
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">Question not found</h1>
        <Button asChild variant="link" className="mt-4">
          <Link href={`/workspace/subject/${subjectId}/paper/${encodeURIComponent(paperTypeId)}/topic/${encodeURIComponent(topicId)}`}>Go back to topic</Link>
        </Button>
      </div>
    );
  }

  const handleBackClick = () => {
    // Progress is already auto-saved via useEffect
    router.push(`/workspace/subject/${subjectId}/paper/${encodeURIComponent(paperTypeId)}/topic/${encodeURIComponent(topicId)}`);
  };

  const handleFinishQuestion = () => {
    setShowFinishDialog(true);
  };

  const handleSaveProgress = async () => {
    // Complete the conversation for RAG search (always try, even with 0 objectives)
    if (conversationId && generatedVariant) {
      const totalObjectives = generatedVariant.solutionObjectives.length;
      const scorePercent = totalObjectives > 0
        ? Math.round((completedObjectives.length / totalObjectives) * 100)
        : 0;
      const completedObjectiveTexts = completedObjectives.map(idx => generatedVariant.solutionObjectives[idx]);
      await completeConversation(conversationId, scorePercent, completedObjectiveTexts);
    }

    if (subject && paperType && topic && completedObjectives.length > 0 && generatedVariant && examQuestion) {
      // Calculate score out of 10 based on objectives completed
      const totalObjectives = generatedVariant.solutionObjectives.length;
      const scoreOutOf10 = (completedObjectives.length / totalObjectives) * 10;
      updateExamQuestionScore(subject.id, paperType.name, topic.name, examQuestion.id, scoreOutOf10);

      toast({
        title: "Progress Saved",
        description: `Completed ${completedObjectives.length}/${totalObjectives} objectives.`,
      });
    }
    // Remove from cache
    removeFromCache(questionId);
    setShowFinishDialog(false);
    router.push(`/workspace/subject/${subjectId}/paper/${encodeURIComponent(paperTypeId)}/topic/${encodeURIComponent(topicId)}`);
  };

  const handleDiscardProgress = () => {
    // Remove from cache
    removeFromCache(questionId);
    setShowFinishDialog(false);
    router.push(`/workspace/subject/${subjectId}/paper/${encodeURIComponent(paperTypeId)}/topic/${encodeURIComponent(topicId)}`);
  };

  const handleConfirmCacheOverwrite = async () => {
    if (oldestCachedQuestion && pendingQuestionGeneration) {
      // Remove the oldest question from cache
      removeFromCache(oldestCachedQuestion.id);
      toast({
        title: "Cache Updated",
        description: "Oldest in-progress question was removed to make room.",
      });

      setShowCacheLimitWarning(false);
      setOldestCachedQuestion(null);

      // Now generate the new question
      setIsLoading(true);
      try {
        await pendingQuestionGeneration();
      } catch (e: any) {
        if (e.message?.includes('no solution objectives')) {
          setNoMarkscheme(true);
          toast({ variant: 'destructive', title: 'No Markscheme', description: 'This question has no markscheme objectives.' });
        } else {
          toast({ variant: 'destructive', title: 'AI Error', description: 'Could not start the interview.' });
        }
        console.error(e);
      } finally {
        setIsLoading(false);
        setPendingQuestionGeneration(null);
      }
    }
  };

  const handleCancelCacheOverwrite = () => {
    setShowCacheLimitWarning(false);
    setOldestCachedQuestion(null);
    setPendingQuestionGeneration(null);
    // Go back to topic
    router.push(`/workspace/subject/${subjectId}/paper/${encodeURIComponent(paperTypeId)}/topic/${encodeURIComponent(topicId)}`);
  };

  // Show loading state while question is being generated
  if (isLoading && !generatedVariant) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner className="w-8 h-8" />
          <p className="text-sm text-muted-foreground">Generating question...</p>
        </div>
      </div>
    );
  }

  // Show no markscheme error
  if (noMarkscheme) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-lg font-bold text-destructive">NO MARKSCHEME FOUND</p>
          <p className="text-sm text-muted-foreground">This question cannot be attempted without marking objectives.</p>
          <Button variant="outline" onClick={handleBackClick}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Topic
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Cache Limit Warning Dialog */}
      <AlertDialog open={showCacheLimitWarning} onOpenChange={setShowCacheLimitWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>In-Progress Question Limit Reached</AlertDialogTitle>
            <AlertDialogDescription>
              You have 5 questions in progress already. Starting this new question will remove your progress on the oldest in-progress question. Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelCacheOverwrite}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCacheOverwrite}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Whiteboard Studio - Primary Interface */}
      <AnimatePresence>
        {isWhiteboardStudio && generatedVariant && (
          <WhiteboardStudio
            questionId={questionId}
            questionText={generatedVariant.questionText}
            objectives={generatedVariant.solutionObjectives}
            chatHistory={chatHistory}
            completedObjectives={completedObjectives}
            onSendMessage={handleSendMessage}
            onExit={handleBackClick}
            isLoading={isLoading}
            subjectId={subjectId}
            paperTypeId={paperTypeId}
            topicId={topicId}
            onFinishQuestion={handleFinishQuestion}
            currentScore={completedObjectives.length}
            previousScore={examQuestion?.score || 0}
            examQuestionSummary={examQuestion?.summary || ''}
            onVoiceMessage={handleVoiceMessage}
            onVoiceEvaluation={handleVoiceEvaluation}
            diagramDescription={generatedVariant.diagramDescription}
            accessLevel={accessLevel}
          />
        )}
      </AnimatePresence>

      {/* Finish Question Dialog */}
      <FinishQuestionDialog
        isOpen={showFinishDialog}
        completedCount={completedObjectives.length}
        totalCount={generatedVariant?.solutionObjectives.length || 0}
        onSave={handleSaveProgress}
        onDiscard={handleDiscardProgress}
        onClose={() => setShowFinishDialog(false)}
      />
    </>
  );
}
