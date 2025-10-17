"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext } from '@/app/context/AppContext';
import { aiPoweredInterview, generateQuestion } from '@/ai/flows/ai-powered-interview';
import type { ChatHistory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Send, User, Bot, ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import PageSpinner from '@/components/PageSpinner';

export default function InterviewPage() {
  const params = useParams();
  const router = useRouter();
  const { getSubjectById, updateExamQuestionScore } = useAppContext();
  const { toast } = useToast();

  const subjectId = params.subjectId as string;
  const paperTypeId = decodeURIComponent(params.paperTypeId as string);
  const topicId = decodeURIComponent(params.topicId as string);
  const questionId = decodeURIComponent(params.questionId as string);

  const subject = getSubjectById(subjectId);
  const paperType = subject?.paperTypes.find(p => p.id === paperTypeId);
  const topic = paperType?.topics.find(t => t.id === topicId);
  const examQuestion = topic?.examQuestions.find(q => q.id === questionId);

  const [chatHistory, setChatHistory] = useState<ChatHistory>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);

  const scrollAreaViewport = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef<string | false>(false);
  const isInitializing = useRef(false);

  useEffect(() => {
    if (scrollAreaViewport.current) {
      scrollAreaViewport.current.scrollTo({ top: scrollAreaViewport.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatHistory]);

  useEffect(() => {
    console.log('=== useEffect triggered ===', { subjectId: subject?.id, questionId: examQuestion?.id });

    if (!subject || !examQuestion) {
      console.log('Early return - no subject or exam question');
      return;
    }

    // Create a unique key for this question to track if we've already initialized
    const questionKey = `${subject.id}-${examQuestion.id}`;

    // Check both if we've already initialized AND if we're currently initializing
    if (hasInitialized.current === questionKey) {
      console.log('Already initialized for this question, skipping');
      return;
    }

    if (isInitializing.current) {
      console.log('Already initializing, skipping duplicate call');
      return;
    }

    const startInterview = async () => {
      console.log('Starting interview...');
      isInitializing.current = true;
      hasInitialized.current = questionKey;
      setIsLoading(true);
      try {
        // Start the interview with an initial greeting (without user answer)
        console.log('Calling aiPoweredInterview...');
        const res = await aiPoweredInterview({
          subsection: examQuestion.summary, // Using summary as context
          question: examQuestion.questionText,
        });
        console.log('Interview started, chat history:', res.chatHistory);
        setChatHistory(res.chatHistory);
      } catch (e) {
        toast({ variant: 'destructive', title: 'AI Error', description: 'Could not start the interview.' });
        console.error(e);
        hasInitialized.current = false; // Reset on error so user can retry
      } finally {
        setIsLoading(false);
        isInitializing.current = false;
      }
    };
    startInterview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject?.id, examQuestion?.id]);

  const handleSendMessage = async () => {
    if (!userInput.trim() || !subject || !examQuestion || isLoading) return;

    setIsLoading(true);
    const currentInput = userInput;
    setUserInput('');

    const newHistory: ChatHistory = [...chatHistory, { role: 'user', content: currentInput }];
    setChatHistory(newHistory);

    try {
      const res = await aiPoweredInterview({
        subsection: examQuestion.summary,
        userAnswer: currentInput,
        previousChatHistory: chatHistory,
        question: examQuestion.questionText,
      });

      setChatHistory(res.chatHistory);

      if (res.isCorrect && res.score) {
        setIsCompleted(true);
        if (paperType && topic) {
            updateExamQuestionScore(subject.id, paperType.name, topic.name, examQuestion.id, res.score);
        }
        toast({
          title: "Question Complete!",
          description: `You scored ${res.score}/10. Redirecting back to topic...`,
        });
        setTimeout(() => {
          router.push(`/subject/${subjectId}/paper/${encodeURIComponent(paperTypeId)}/topic/${encodeURIComponent(topicId)}`);
        }, 3000);
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'AI Error', description: 'Could not get AI response.' });
      console.error(e);
      setChatHistory(chatHistory); // Revert history on error
    } finally {
      setIsLoading(false);
    }
  };

  if (!subject || !topic || !examQuestion) {
    if (isLoading) return <PageSpinner />;
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">Question not found</h1>
        <Button asChild variant="link" className="mt-4">
          <Link href={`/subject/${subjectId}/paper/${encodeURIComponent(paperTypeId)}/topic/${encodeURIComponent(topicId)}`}>Go back to topic</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto h-[calc(100vh-8rem)]">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        {/* Left Side - Question Info */}
        <div className="lg:col-span-1 space-y-4 max-h-full overflow-y-auto">
          <Button variant="ghost" onClick={() => router.push(`/subject/${subjectId}/paper/${encodeURIComponent(paperTypeId)}/topic/${encodeURIComponent(topicId)}`)} className="w-full">
            <ArrowLeft />
            Back to Questions
          </Button>

          <Card>
            <CardContent className="p-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Topic</h2>
              <p className="text-sm font-medium">{topic.name}</p>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Question</h2>
              <p className="text-lg font-semibold mb-3">{examQuestion.summary}</p>
              <div className="max-h-96 overflow-y-auto">
                <p className="text-sm whitespace-pre-wrap">{examQuestion.questionText}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side - Chat Interface */}
        <div className="lg:col-span-2 min-h-0">
          <Card className="h-full flex flex-col">
            <CardContent className="flex-1 flex flex-col p-0 min-h-0">
              <ScrollArea className="flex-1 p-4 min-h-0" viewportRef={scrollAreaViewport}>
                <div className="space-y-6">
                  {chatHistory.map((message, index) => (
                    <div key={index} className={cn("flex items-start gap-3", message.role === 'user' ? "justify-end" : "")}>
                      {message.role === 'assistant' && (
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarFallback><Bot size={20} /></AvatarFallback>
                        </Avatar>
                      )}
                      <div className={cn("rounded-lg px-4 py-3 max-w-lg whitespace-pre-wrap break-words",
                        message.role === 'assistant' ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"
                      )}>
                        <p className="text-sm">{message.content}</p>
                      </div>
                      {message.role === 'user' && (
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarFallback><User size={20} /></AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                  {isLoading && chatHistory.length > 0 && (
                     <div className="flex items-start gap-3">
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarFallback><Bot size={20} /></AvatarFallback>
                        </Avatar>
                        <div className="rounded-lg px-4 py-3 bg-secondary text-secondary-foreground">
                           <LoadingSpinner className="w-5 h-5" />
                        </div>
                     </div>
                  )}
                   {isLoading && chatHistory.length === 0 && (
                      <div className="flex items-center justify-center h-full">
                        <LoadingSpinner className="w-8 h-8" />
                      </div>
                  )}
                </div>
              </ScrollArea>
              <div className="p-4 border-t shrink-0">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Type your answer..."
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    disabled={isLoading || isCompleted}
                  />
                  <Button onClick={handleSendMessage} disabled={isLoading || isCompleted || !userInput.trim()}>
                    {isLoading ? <LoadingSpinner /> : <Send />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
