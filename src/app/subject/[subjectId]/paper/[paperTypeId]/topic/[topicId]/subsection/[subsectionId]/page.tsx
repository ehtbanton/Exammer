"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext } from '@/app/context/AppContext';
import { AuthGuard } from '@/components/AuthGuard';
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
  return (
    <AuthGuard>
      <InterviewPageContent />
    </AuthGuard>
  );
}

function InterviewPageContent() {
  const params = useParams();
  const router = useRouter();
  const { getSubjectById, updateSubsectionScore } = useAppContext();
  const { toast } = useToast();

  const subjectId = params.subjectId as string;
  const paperTypeId = decodeURIComponent(params.paperTypeId as string);
  const topicId = decodeURIComponent(params.topicId as string);
  const subsectionId = decodeURIComponent(params.subsectionId as string);

  const subject = getSubjectById(subjectId);
  const paperType = subject?.paperTypes.find(p => p.id === paperTypeId);
  const topic = paperType?.topics.find(t => t.id === topicId);
  const subsection = topic?.subsections.find(s => s.id === subsectionId);

  const [chatHistory, setChatHistory] = useState<ChatHistory>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');

  const scrollAreaViewport = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (scrollAreaViewport.current) {
      scrollAreaViewport.current.scrollTo({ top: scrollAreaViewport.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatHistory]);

  useEffect(() => {
    console.log('=== useEffect triggered ===', { subjectId: subject?.id, subsectionId: subsection?.id });

    if (!subject || !subsection) {
      console.log('Early return - no subject or subsection');
      return;
    }

    // Create a unique key for this subsection to track if we've already initialized
    const subsectionKey = `${subject.id}-${subsection.id}`;

    if (hasInitialized.current === subsectionKey) {
      console.log('Already initialized for this subsection, skipping');
      return;
    }

    const startInterview = async () => {
      console.log('Starting interview...');
      hasInitialized.current = subsectionKey;
      setIsLoading(true);
      try {
        const pastPapersContent = subject.pastPapers.map(p => p.content).join('\n\n---\n\n');

        // Generate the question separately
        console.log('Calling generateQuestion...');
        const questionRes = await generateQuestion({
          subsection: subsection.name,
          pastPapers: pastPapersContent,
        });
        console.log('Question generated:', questionRes.question);
        setCurrentQuestion(questionRes.question);

        // Start the interview with an initial greeting (without user answer)
        console.log('Calling aiPoweredInterview...');
        const res = await aiPoweredInterview({
          subsection: subsection.name,
          pastPapers: pastPapersContent,
          question: questionRes.question,
        });
        console.log('Interview started, chat history:', res.chatHistory);
        setChatHistory(res.chatHistory);
      } catch (e) {
        toast({ variant: 'destructive', title: 'AI Error', description: 'Could not start the interview.' });
        console.error(e);
        hasInitialized.current = false; // Reset on error so user can retry
      } finally {
        setIsLoading(false);
      }
    };
    startInterview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject?.id, subsection?.id]);

  const handleSendMessage = async () => {
    if (!userInput.trim() || !subject || !subsection || isLoading) return;

    setIsLoading(true);
    const currentInput = userInput;
    setUserInput('');

    const newHistory: ChatHistory = [...chatHistory, { role: 'user', content: currentInput }];
    setChatHistory(newHistory);

    try {
      const pastPapersContent = subject.pastPapers.map(p => p.content).join('\n\n---\n\n');
      const res = await aiPoweredInterview({
        subsection: subsection.name,
        pastPapers: pastPapersContent,
        userAnswer: currentInput,
        previousChatHistory: chatHistory,
        question: currentQuestion,
      });

      setChatHistory(res.chatHistory);

      if (res.isCorrect && res.score) {
        setIsCompleted(true);
        if (paperType && topic) {
            updateSubsectionScore(subject.id, paperType.name, topic.name, subsection.name, res.score);
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

  if (!subject || !topic || !subsection) {
    if (isLoading) return <PageSpinner />;
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">Content not found</h1>
        <Button asChild variant="link" className="mt-4">
          <Link href={`/subject/${subjectId}/paper/${encodeURIComponent(paperTypeId)}/topic/${encodeURIComponent(topicId)}`}>Go back to topic</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] md:h-[calc(100vh-11rem)] max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => router.push(`/subject/${subjectId}/paper/${encodeURIComponent(paperTypeId)}/topic/${encodeURIComponent(topicId)}`)} className="mb-4 self-start">
            <ArrowLeft />
            Back to Subsections
        </Button>
      <h1 className="text-2xl font-bold font-headline mb-4">{subsection.name}</h1>

      {/* Question Display */}
      {currentQuestion && (
        <Card className="mb-4 bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">Question:</h2>
            <p className="text-base whitespace-pre-wrap">{currentQuestion}</p>
          </CardContent>
        </Card>
      )}

      <Card className="flex-1 flex flex-col">
        <CardContent className="flex-1 flex flex-col p-0">
          <ScrollArea className="flex-1 p-4" viewportRef={scrollAreaViewport}>
            <div className="space-y-6">
              {chatHistory.map((message, index) => (
                <div key={index} className={cn("flex items-start gap-3", message.role === 'user' ? "justify-end" : "")}>
                  {message.role === 'assistant' && (
                    <Avatar className="w-8 h-8">
                      <AvatarFallback><Bot size={20} /></AvatarFallback>
                    </Avatar>
                  )}
                  <div className={cn("rounded-lg px-4 py-3 max-w-lg whitespace-pre-wrap", 
                    message.role === 'assistant' ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"
                  )}>
                    <p className="text-sm">{message.content}</p>
                  </div>
                  {message.role === 'user' && (
                    <Avatar className="w-8 h-8">
                      <AvatarFallback><User size={20} /></AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              {isLoading && chatHistory.length > 0 && (
                 <div className="flex items-start gap-3">
                    <Avatar className="w-8 h-8">
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
          <div className="p-4 border-t">
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
  );
}
