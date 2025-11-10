"use client";

import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext } from '@/app/context/AppContext';
import { AuthGuard } from '@/components/AuthGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import LoadingSpinner from '@/components/LoadingSpinner';
import PageSpinner from '@/components/PageSpinner';
import { ArrowLeft, BookCopy, FileText, Info } from 'lucide-react';
import { Topic } from '@/lib/types';
import { getScoreColorStyle, getDefaultBoxStyle, getUnattemptedBoxStyle } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { UnderstandingIndicator } from '@/components/ui/understanding-indicator';

export default function PaperTypePage() {
  return (
    <AuthGuard>
      <PaperTypePageContent />
    </AuthGuard>
  );
}

function PaperTypePageContent() {
  const params = useParams();
  const router = useRouter();
  const { subjects, processExamPapers, processMarkschemes, isLoading, setLoading } = useAppContext();

  const subjectId = params.subjectId as string;
  const paperTypeId = decodeURIComponent(params.paperTypeId as string);

  const subject = subjects.find(s => s.id === subjectId);
  const paperType = subject?.paperTypes.find(p => p.id === paperTypeId);

  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [hideEmptyTopics, setHideEmptyTopics] = useState(true);

  // Paper upload state
  const paperInputRef = useRef<HTMLInputElement>(null);
  const [isPaperDialogOpen, setPaperDialogOpen] = useState(false);
  const [selectedPapers, setSelectedPapers] = useState<File[]>([]);

  // Markscheme upload state
  const markschemeInputRef = useRef<HTMLInputElement>(null);
  const [isMarkschemeDialogOpen, setMarkschemeDialogOpen] = useState(false);
  const [selectedMarkschemes, setSelectedMarkschemes] = useState<File[]>([]);

  useEffect(() => {
    // Reset loading state on mount in case user navigated back
    if (paperType) {
       paperType.topics.forEach(topic => setLoading(`navigate-topic-${topic.id}`, false));
    }
  }, [paperType, setLoading]);

  // Truncate filename if longer than 43 characters: first 20 + "..." + last 20
  const truncateFilename = (filename: string) => {
    if (filename.length <= 43) return filename;
    return filename.slice(0, 20) + '...' + filename.slice(-20);
  };

  const handlePaperSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedPapers(prev => [...prev, ...files]);
  };

  const removePaper = (index: number) => {
    setSelectedPapers(prev => prev.filter((_, i) => i !== index));
  };

  const handleMarkschemeSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedMarkschemes(prev => [...prev, ...files]);
  };

  const removeMarkscheme = (index: number) => {
    setSelectedMarkschemes(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadPapers = async () => {
    if (selectedPapers.length > 0 && subject && paperType) {
      await processExamPapers(subject.id, paperType.id, selectedPapers);
      setSelectedPapers([]);
      setPaperDialogOpen(false);
    }
  };

  const handleUploadMarkschemes = async () => {
    if (selectedMarkschemes.length > 0 && subject && paperType) {
      await processMarkschemes(subject.id, paperType.id, selectedMarkschemes);
      setSelectedMarkschemes([]);
      setMarkschemeDialogOpen(false);
    }
  };

  const handleCancelPaperDialog = () => {
    setSelectedPapers([]);
    setPaperDialogOpen(false);
  };

  const handleCancelMarkschemeDialog = () => {
    setSelectedMarkschemes([]);
    setMarkschemeDialogOpen(false);
  };

  const handleNavigate = (topicId: string) => {
    const loadingKey = `navigate-topic-${topicId}`;
    setLoading(loadingKey, true);
    setNavigatingTo(topicId);
    // Let the Link component handle navigation
  };

  if (navigatingTo && isLoading(`navigate-topic-${navigatingTo}`)) {
    return <PageSpinner />;
  }

  // Show loading spinner while subjects are being fetched
  if (isLoading('fetch-subjects')) {
    return <PageSpinner />;
  }

  if (!subject || !paperType) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">Paper Type not found</h1>
        <Button asChild variant="link" className="mt-4">
          <Link href={`/workspace/subject/${subjectId}`}>Go back to subject</Link>
        </Button>
      </div>
    );
  }

  // Calculate average score for each topic based only on attempted questions
  const getTopicAverageScore = (topic: Topic): number | null => {
    const allQuestions = topic.examQuestions || [];
    if (allQuestions.length === 0) return null;

    // Only include questions with at least 1 attempt
    const attemptedQuestions = allQuestions.filter(q => q.attempts > 0);
    if (attemptedQuestions.length === 0) return null;

    const sum = attemptedQuestions.reduce((acc, q) => acc + q.score, 0);
    return sum / attemptedQuestions.length;
  };

  // Filter topics based on toggle
  const filteredTopics = hideEmptyTopics
    ? paperType?.topics.filter(topic => topic.examQuestions && topic.examQuestions.length > 0) || []
    : paperType?.topics || [];

  const isPaperLoading = isLoading(`process-papers-${subject?.id}-${paperType?.id}`);
  const isMarkschemeLoading = isLoading(`process-markschemes-${subject?.id}-${paperType?.id}`);

  return (
    <div className="container mx-auto">
      <Button variant="ghost" onClick={() => router.push(`/workspace/subject/${subjectId}`)} className="mb-4">
        <ArrowLeft />
        Back to Paper Types
      </Button>
      <h1 className="text-3xl font-bold font-headline mb-2">{paperType.name}</h1>
      <p className="text-muted-foreground mb-8">Topics for {subject.name}</p>

      {/* Paper and Markscheme Upload - Only for creators */}
      {subject?.isCreator && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText /> Upload Materials</CardTitle>
            <CardDescription>Upload past papers and markschemes for {paperType.name}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Dialog open={isPaperDialogOpen} onOpenChange={setPaperDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary">Upload Past Papers</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Upload Past Papers for {paperType.name}</DialogTitle>
                  <DialogDescription>
                    Upload past exam papers to extract questions for all topics in this paper type. Questions will be automatically categorized.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                      <div className="text-sm text-blue-800 dark:text-blue-200">
                        <p className="font-semibold mb-1">Include date in filename</p>
                        <p>
                          For best results, include the paper date in the filename using format <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">yyyy-mm-dd</code> (e.g., "2024-06-15_physics.pdf"). Partial dates like <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">2024-06</code> or just <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">2024</code> work too.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Button onClick={() => paperInputRef.current?.click()} variant="outline" type="button" className="w-full">
                      <FileText className="mr-2 h-4 w-4" />
                      Add Exam Papers
                    </Button>
                    <Input
                      type="file"
                      ref={paperInputRef}
                      className="hidden"
                      onChange={handlePaperSelect}
                      accept=".pdf,.txt,.md"
                      multiple
                    />

                    {selectedPapers.length > 0 && (
                      <div className="mt-3 max-h-64 overflow-y-auto overflow-x-hidden border rounded-md p-2 space-y-2">
                        {selectedPapers.map((paper, index) => (
                          <div key={index} className="flex items-center justify-between gap-2 p-2 bg-muted rounded">
                            <span className="text-sm flex-1">{truncateFilename(paper.name)}</span>
                            <Button variant="ghost" size="sm" onClick={() => removePaper(index)} className="shrink-0 whitespace-nowrap">
                              <span className="text-xs">Remove</span>
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={handleCancelPaperDialog} className="flex-1">
                      Cancel
                    </Button>
                    <Button onClick={handleUploadPapers} className="flex-1" disabled={isPaperLoading || selectedPapers.length === 0}>
                      {isPaperLoading ? <LoadingSpinner /> : 'Process Papers & Extract Questions'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isMarkschemeDialogOpen} onOpenChange={setMarkschemeDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Upload Markschemes</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Upload Markschemes for {paperType.name}</DialogTitle>
                  <DialogDescription>
                    Upload markschemes to match with existing questions and enable objective-based grading.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                      <div className="text-sm text-blue-800 dark:text-blue-200">
                        <p className="font-semibold mb-1">Include date in filename</p>
                        <p>
                          For automatic matching, include the date in filename format <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">yyyy-mm-dd</code> (e.g., "2024-06-15_markscheme.pdf"). Markschemes match to questions by year and question number.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Button onClick={() => markschemeInputRef.current?.click()} variant="outline" type="button" className="w-full">
                      <FileText className="mr-2 h-4 w-4" />
                      Add Markschemes
                    </Button>
                    <Input
                      type="file"
                      ref={markschemeInputRef}
                      className="hidden"
                      onChange={handleMarkschemeSelect}
                      accept=".pdf,.txt,.md"
                      multiple
                    />

                    {selectedMarkschemes.length > 0 && (
                      <div className="mt-3 max-h-64 overflow-y-auto overflow-x-hidden border rounded-md p-2 space-y-2">
                        {selectedMarkschemes.map((markscheme, index) => (
                          <div key={index} className="flex items-center justify-between gap-2 p-2 bg-muted rounded">
                            <span className="text-sm flex-1">{truncateFilename(markscheme.name)}</span>
                            <Button variant="ghost" size="sm" onClick={() => removeMarkscheme(index)} className="shrink-0 whitespace-nowrap">
                              <span className="text-xs">Remove</span>
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={handleCancelMarkschemeDialog} className="flex-1">
                      Cancel
                    </Button>
                    <Button onClick={handleUploadMarkschemes} className="flex-1" disabled={isMarkschemeLoading || selectedMarkschemes.length === 0}>
                      {isMarkschemeLoading ? <LoadingSpinner /> : 'Process Markschemes & Match'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold font-headline flex items-center gap-2"><BookCopy /> Topics</h2>
          <div className="flex items-center gap-2">
            <Switch
              id="hide-empty-topics"
              checked={hideEmptyTopics}
              onCheckedChange={setHideEmptyTopics}
            />
            <Label htmlFor="hide-empty-topics" className="text-sm">Hide topics without questions</Label>
          </div>
        </div>
        {filteredTopics.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTopics.map((topic: Topic) => {
              const avgScore = getTopicAverageScore(topic);
              const hasScore = avgScore !== null;
              const hasQuestions = topic.examQuestions && topic.examQuestions.length > 0;

              // Calculate progress
              const totalQuestions = topic.examQuestions?.length || 0;
              const attemptedQuestions = topic.examQuestions?.filter(q => q.attempts > 0).length || 0;
              const progressPercentage = totalQuestions > 0 ? (attemptedQuestions / totalQuestions) * 100 : 0;

              // Determine which style to use
              let boxStyle;
              if (hasScore) {
                boxStyle = getScoreColorStyle(avgScore);
              } else if (hasQuestions) {
                boxStyle = getUnattemptedBoxStyle(); // Has questions but no attempts
              } else {
                boxStyle = getDefaultBoxStyle(); // No questions at all
              }

              return (
                <Link key={topic.id} href={`/workspace/subject/${subjectId}/paper/${encodeURIComponent(paperTypeId)}/topic/${encodeURIComponent(topic.id)}`} onClick={() => handleNavigate(topic.id)} className="block hover:no-underline">
                  <Card
                    className="hover:shadow-[0_0_0_4px_rgb(55,65,81)] dark:hover:shadow-[0_0_0_4px_white] transition-all h-full border-2"
                    style={boxStyle}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <CardTitle className="text-lg text-black flex-1">{topic.name}</CardTitle>
                        {hasScore && (
                          <UnderstandingIndicator percentage={avgScore} size="sm" />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm text-black">{totalQuestions > 0 ? `${attemptedQuestions}/${totalQuestions} attempted` : 'No questions yet'}</p>
                      {totalQuestions > 0 && (
                        <Progress value={progressPercentage} className="h-2" />
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <h3 className="text-lg font-semibold">No topics found for this paper</h3>
              <p className="text-muted-foreground mt-1">The AI might not have identified any topics for this paper type in the syllabus.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
