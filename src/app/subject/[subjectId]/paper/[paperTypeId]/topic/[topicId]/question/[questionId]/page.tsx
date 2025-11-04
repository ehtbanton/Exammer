"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext } from '@/app/context/AppContext';
import { AuthGuard } from '@/components/AuthGuard';
import { aiPoweredInterview, generateQuestion } from '@/ai/flows/ai-powered-interview';
import { executeDevCommand } from '@/ai/flows/dev-commands';
import { isDevCommand } from '@/lib/dev-commands-helpers';
import type { ChatHistory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Send, User, Bot, ArrowLeft, MessageSquare, PenTool, Terminal } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import PageSpinner from '@/components/PageSpinner';
import { Whiteboard } from '@/components/whiteboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  const { getSubjectById, updateExamQuestionScore, generateQuestionVariant, isLoading: isAppLoading } = useAppContext();
  const { toast } = useToast();
  const { data: session, status } = useSession();

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
  const [generatedVariant, setGeneratedVariant] = useState<{questionText: string; solutionObjectives: string[]} | null>(null);
  const [inputMode, setInputMode] = useState<'text' | 'whiteboard'>('text');
  const [accessLevel, setAccessLevel] = useState<number | null>(null);
  const [completedObjectives, setCompletedObjectives] = useState<number[]>([]);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [noMarkscheme, setNoMarkscheme] = useState(false);

  // Compute if all objectives are completed
  const isCompleted = generatedVariant
    ? completedObjectives.length === generatedVariant.solutionObjectives.length
    : false;

  const scrollAreaViewport = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (scrollAreaViewport.current) {
      scrollAreaViewport.current.scrollTo({ top: scrollAreaViewport.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatHistory]);

  useEffect(() => {
    console.log('=== useEffect triggered ===', { subjectId: subject?.id, questionId: examQuestion?.id });

    if (!subject || !examQuestion || !paperType || !topic) {
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
        // Generate a fresh variant EVERY time
        console.log('Generating question variant with adapted objectives...');
        const variantData = await generateQuestionVariant(subject.id, paperType.id, topic.id, examQuestion.id);
        setGeneratedVariant(variantData);
        console.log('Question variant generated successfully with', variantData.solutionObjectives.length, 'objectives');

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
  }, [subject?.id, examQuestion?.id]);

  const handleSendMessage = async (imageData?: string) => {
    if ((!userInput.trim() && !imageData) || !subject || !examQuestion || isLoading || !generatedVariant) return;

    setIsLoading(true);
    const currentInput = userInput;
    setUserInput('');

    // Check if this is a dev command (level 3 users only)
    if (accessLevel === 3 && !imageData && isDevCommand(currentInput)) {
      try {
        toast({
          title: "Dev Command Detected",
          description: `Executing: ${currentInput}`,
        });

        const devResult = await executeDevCommand({
          command: currentInput,
          question: generatedVariant.questionText,
          subsection: examQuestion.summary,
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
        toast({ variant: 'destructive', title: 'Dev Command Error', description: 'Failed to execute dev command.' });
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
    } catch (e) {
      toast({ variant: 'destructive', title: 'AI Error', description: 'Could not get AI response.' });
      console.error(e);
      setChatHistory(chatHistory); // Revert history on error
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
          <Link href={`/subject/${subjectId}/paper/${encodeURIComponent(paperTypeId)}/topic/${encodeURIComponent(topicId)}`}>Go back to topic</Link>
        </Button>
      </div>
    );
  }

  // Format question text with better spacing for parts
  const formatQuestionText = (text: string) => {
    if (!text) return text;

    // Add spacing before lettered parts like "a)" or "(a)" at the start of a line
    let formatted = text.replace(/(\n|^)\s*\(?([a-z])\)\s*/gim, '\n\n$2) ');

    // Add spacing before roman numeral parts like "i)" or "(i)" at the start of a line
    formatted = formatted.replace(/(\n|^)\s*\(?(i{1,3}|iv|v|vi{0,3}|ix|x)\)\s*/gim, '\n$2) ');

    return formatted.trim();
  };

  const handleBackClick = () => {
    if (chatHistory.length > 1) { // Has started answering
      setShowExitDialog(true);
    } else {
      router.push(`/subject/${subjectId}/paper/${encodeURIComponent(paperTypeId)}/topic/${encodeURIComponent(topicId)}`);
    }
  };

  const handleAcceptScore = () => {
    if (paperType && topic && completedObjectives.length > 0 && generatedVariant) {
      // Calculate score out of 10 based on objectives completed
      const totalObjectives = generatedVariant.solutionObjectives.length;
      const scoreOutOf10 = (completedObjectives.length / totalObjectives) * 10;
      updateExamQuestionScore(subject.id, paperType.name, topic.name, examQuestion.id, scoreOutOf10);
      toast({
        title: "Progress Saved",
        description: `Completed ${completedObjectives.length}/${totalObjectives} objectives.`,
      });
    }
    router.push(`/subject/${subjectId}/paper/${encodeURIComponent(paperTypeId)}/topic/${encodeURIComponent(topicId)}`);
  };

  const handleDiscardProgress = () => {
    router.push(`/subject/${subjectId}/paper/${encodeURIComponent(paperTypeId)}/topic/${encodeURIComponent(topicId)}`);
  };

  return (
    <div className="container mx-auto h-[calc(100vh-6rem)] flex flex-col p-4">
      {/* Header with Back Button and Topic */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b shrink-0">
        <Button variant="ghost" onClick={handleBackClick}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Questions
        </Button>
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">Topic:</span> {topic.name}
        </div>
      </div>

      {/* Exit Confirmation Dialog */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Your Progress?</AlertDialogTitle>
            <AlertDialogDescription>
              {generatedVariant ? (
                `You've completed ${completedObjectives.length}/${generatedVariant.solutionObjectives.length} objectives. Would you like to save your progress?`
              ) : (
                'Would you like to save your progress on this question?'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardProgress}>Discard</AlertDialogCancel>
            <AlertDialogAction onClick={handleAcceptScore}>Save Progress</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Main Content - Question Left, Chat Right */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0 overflow-hidden">
        {/* Left Side - Question Display */}
        <div className="flex flex-col h-full overflow-hidden">
          <Card className="bg-primary/5 border-primary/20 flex-1 flex flex-col h-full overflow-hidden">
            <CardContent className="flex-1 flex flex-col p-0 h-full overflow-hidden">
              {noMarkscheme ? (
                <div className="flex items-center justify-center flex-1 p-6">
                  <div className="text-center space-y-2">
                    <p className="text-lg font-bold text-destructive">NO MARKSCHEME FOUND</p>
                    <p className="text-sm text-muted-foreground">This question cannot be attempted without marking objectives.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-6 pb-4 border-b space-y-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-muted-foreground uppercase">Question</h2>
                      {generatedVariant && (
                        <span className="text-sm font-bold">{completedObjectives.length}/{generatedVariant.solutionObjectives.length} objectives</span>
                      )}
                    </div>
                    {generatedVariant && (
                      <Progress value={(completedObjectives.length / generatedVariant.solutionObjectives.length) * 100} className="h-2" />
                    )}
                  </div>
                  {generatedVariant ? (
                    <>
                      <ScrollArea className="flex-1 p-6 overflow-auto">
                        <div className="prose prose-base max-w-none dark:prose-invert">
                          <div className="text-base leading-relaxed whitespace-pre-wrap break-words font-normal">
                            {formatQuestionText(generatedVariant.questionText)}
                          </div>
                        </div>
                        {completedObjectives.length > 0 && (
                          <div className="mt-6 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                            <h3 className="text-sm font-semibold mb-2 text-green-800 dark:text-green-200">✓ Objectives Achieved:</h3>
                            <ul className="space-y-1">
                              {completedObjectives.map(idx => (
                                <li key={idx} className="text-sm text-green-700 dark:text-green-300 flex items-start gap-2">
                                  <span className="font-mono text-xs mt-0.5">[{idx}]</span>
                                  <span>{generatedVariant.solutionObjectives[idx]}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </ScrollArea>
                      <div className="p-4 border-t shrink-0">
                        <p className="text-xs text-muted-foreground italic">✨ Similar question generated for practice</p>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center gap-3 flex-1 overflow-hidden">
                      <LoadingSpinner className="w-5 h-5" />
                      <p className="text-sm text-muted-foreground">Generating similar question...</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side - Chat Interface */}
        <div className="flex flex-col h-full overflow-hidden">
          <Card className="flex-1 flex flex-col h-full overflow-hidden">
            <CardContent className="flex-1 flex flex-col p-0 h-full overflow-hidden">
              <ScrollArea className="flex-1 p-4 overflow-auto" viewportRef={scrollAreaViewport}>
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
                        {message.imageUrl && (
                          <img
                            src={message.imageUrl}
                            alt="Whiteboard drawing"
                            className="max-w-full h-auto rounded mb-2"
                          />
                        )}
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
                <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'text' | 'whiteboard')}>
                  <TabsList className="grid w-full grid-cols-2 mb-3">
                    <TabsTrigger value="text" disabled={isLoading || isCompleted}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Text
                    </TabsTrigger>
                    <TabsTrigger value="whiteboard" disabled={isLoading || isCompleted}>
                      <PenTool className="h-4 w-4 mr-2" />
                      Whiteboard
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="text" className="mt-0">
                    <div className="space-y-2">
                      {accessLevel === 3 && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                          <Terminal className="h-3 w-3" />
                          <span>Dev commands enabled: <code className="bg-background px-1 rounded">fullans</code></span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder={accessLevel === 3 ? "Type your answer or dev command..." : "Type your answer..."}
                          value={userInput}
                          onChange={(e) => setUserInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                          onPaste={(e) => e.preventDefault()}
                          disabled={isLoading || isCompleted}
                          className={accessLevel === 3 && isDevCommand(userInput) ? "text-blue-600 font-bold dark:text-blue-400" : ""}
                        />
                        <Button onClick={() => handleSendMessage()} disabled={isLoading || isCompleted || !userInput.trim()}>
                          {isLoading ? <LoadingSpinner /> : <Send />}
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="whiteboard" className="mt-0">
                    <Whiteboard
                      onSubmit={handleSendMessage}
                      disabled={isLoading || isCompleted}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
