"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppContext } from '@/app/context/AppContext';
import { aiPoweredInterview } from '@/ai/flows/ai-powered-interview';
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

export default function InterviewPage() {
  const params = useParams();
  const router = useRouter();
  const { getExamById, updateSubsectionScore } = useAppContext();
  const { toast } = useToast();

  const examId = params.examId as string;
  const topicId = params.topicId as string;
  const subsectionId = params.subsectionId as string;

  const exam = getExamById(examId);
  const topic = exam?.topics.find(t => t.id === topicId);
  const subsection = topic?.subsections.find(s => s.id === subsectionId);

  const [chatHistory, setChatHistory] = useState<ChatHistory>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatHistory]);

  useEffect(() => {
    const startInterview = async () => {
      if (!exam || !subsection) return;

      try {
        const pastPapersContent = exam.pastPapers.map(p => p.content).join('\n\n---\n\n');
        const res = await aiPoweredInterview({
          subsection: subsection.name,
          pastPapers: pastPapersContent,
        });
        setChatHistory(res.chatHistory);
      } catch (e) {
        toast({ variant: 'destructive', title: 'AI Error', description: 'Could not start the interview.' });
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    startInterview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam?.id, subsection?.id]);

  const handleSendMessage = async () => {
    if (!userInput.trim() || !exam || !subsection || isLoading) return;

    setIsLoading(true);
    const currentInput = userInput;
    setUserInput('');

    const newHistory: ChatHistory = [...chatHistory, { role: 'user', content: currentInput }];
    setChatHistory(newHistory);

    try {
      const pastPapersContent = exam.pastPapers.map(p => p.content).join('\n\n---\n\n');
      const res = await aiPoweredInterview({
        subsection: subsection.name,
        pastPapers: pastPapersContent,
        userAnswer: currentInput,
        previousChatHistory: chatHistory,
      });

      setChatHistory(res.chatHistory);

      if (res.isCorrect && res.score) {
        setIsCompleted(true);
        updateSubsectionScore(exam.id, topic.name, subsection.name, res.score);
        toast({
          title: "Question Complete!",
          description: `You scored ${res.score}/10. Redirecting back to topic...`,
        });
        setTimeout(() => {
          router.push(`/exam/${examId}/topic/${topicId}`);
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

  if (!exam || !topic || !subsection) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">Content not found</h1>
        <Button asChild variant="link" className="mt-4">
          <Link href={`/exam/${examId}/topic/${topicId}`}>Go back to topic</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] md:h-[calc(100vh-11rem)] max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => router.push(`/exam/${examId}/topic/${topicId}`)} className="mb-4 self-start">
            <ArrowLeft />
            Back to Subsections
        </Button>
      <h1 className="text-2xl font-bold font-headline mb-4">{subsection.name}</h1>
      <Card className="flex-1 flex flex-col">
        <CardContent className="flex-1 flex flex-col p-0">
          <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
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
                <Send />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
