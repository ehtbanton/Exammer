"use client";

import { ChangeEvent, useRef, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext } from '@/app/context/AppContext';
import { AuthGuard } from '@/components/AuthGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import LoadingSpinner from '@/components/LoadingSpinner';
import PageSpinner from '@/components/PageSpinner';
import { ArrowLeft, BookCopy, FileText, List, Upload, Crown } from 'lucide-react';
import { getScoreColorStyle, getDefaultBoxStyle } from '@/lib/utils';
import { PaperType } from '@/lib/types';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function SubjectPage() {
  return (
    <AuthGuard>
      <SubjectPageContent />
    </AuthGuard>
  );
}

function SubjectPageContent() {
  const params = useParams();
  const router = useRouter();
  const { subjects, processExamPapers, isLoading, setLoading } = useAppContext();
  const subjectId = params.subjectId as string;
  const subject = subjects.find(s => s.id === subjectId);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  const paperInputRef = useRef<HTMLInputElement>(null);
  const [isPaperDialogOpen, setPaperDialogOpen] = useState(false);
  const [selectedPapers, setSelectedPapers] = useState<File[]>([]);
  const [hideEmptyPapers, setHideEmptyPapers] = useState(true);

  useEffect(() => {
    // Reset loading state on mount in case user navigated back
    if (subject) {
      setLoading(`navigate-${subject.id}`, false);
      subject.paperTypes.forEach(pt => setLoading(`navigate-paper-${pt.id}`, false));
    }
  }, [subject, setLoading]);

  const handlePaperSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedPapers(prev => [...prev, ...files]);
  };

  const removePaper = (index: number) => {
    setSelectedPapers(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadPapers = async () => {
    if (selectedPapers.length > 0 && subject) {
      await processExamPapers(subject.id, selectedPapers);
      setSelectedPapers([]);
      setPaperDialogOpen(false);
    }
  };

  const handleNavigate = (paperTypeId: string) => {
    setLoading(`navigate-paper-${paperTypeId}`, true);
    setNavigatingTo(paperTypeId);
    router.push(`/subject/${subjectId}/paper/${paperTypeId}`);
  };
  
  if (navigatingTo && isLoading(`navigate-paper-${navigatingTo}`)) {
    return <PageSpinner />;
  }

  if (!subject) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">Subject not found</h1>
        <Button asChild variant="link" className="mt-4">
          <Link href="/">Go back to subjects</Link>
        </Button>
      </div>
    );
  }

  const isPaperLoading = isLoading(`process-papers-${subject.id}`);

  // Calculate average score for a paper type
  const getPaperTypeAverageScore = (paperType: PaperType): number | null => {
    const topicsWithQuestions = paperType.topics.filter(t => t.examQuestions && t.examQuestions.length > 0);
    if (topicsWithQuestions.length === 0) return null;

    let totalScore = 0;
    let totalQuestions = 0;

    for (const topic of topicsWithQuestions) {
      // Include all questions - unattempted questions have a score of 0
      const allQuestions = topic.examQuestions || [];
      for (const question of allQuestions) {
        totalScore += question.score;
        totalQuestions++;
      }
    }

    if (totalQuestions === 0) return null;
    return totalScore / totalQuestions;
  };

  // Check if a paper type has any questions
  const paperTypeHasQuestions = (paperType: PaperType): boolean => {
    return paperType.topics.some(t => t.examQuestions && t.examQuestions.length > 0);
  };

  // Filter papers based on toggle
  const filteredPaperTypes = hideEmptyPapers
    ? subject?.paperTypes.filter(paperTypeHasQuestions) || []
    : subject?.paperTypes || [];

  return (
    <div className="container mx-auto">
      <Button variant="ghost" onClick={() => router.push('/')} className="mb-4">
        <ArrowLeft />
        Back to Subjects
      </Button>
      <div className="flex items-center gap-2 mb-2">
        <h1 className="text-3xl font-bold font-headline">{subject.name}</h1>
        {subject.isCreator && (
          <span title="Created by you">
            <Crown className="h-6 w-6 text-yellow-500" />
          </span>
        )}
      </div>
      <p className="text-muted-foreground mb-8">
        {subject.isCreator ? 'Manage your subject, syllabus, and past papers' : 'View and practice questions from this subject'}
      </p>

      {/* Syllabus and Past Papers Info - Only show for creators */}
      {subject.isCreator && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText /> Syllabus Info</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-green-600">Syllabus uploaded and {subject.paperTypes.length} paper types identified.</p>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><List /> Past Papers</CardTitle>
              <CardDescription>Resets existing past papers that were previously uploaded.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Dialog open={isPaperDialogOpen} onOpenChange={setPaperDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="secondary">Add All Past Papers</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Upload Past Exam Papers</DialogTitle>
                    <DialogDescription>
                      Upload past exam papers to extract real exam questions for all topics in "{subject.name}".
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Recommended:</strong> Upload at least 1 paper for each paper type.
                      </p>
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
                        <div className="mt-3 max-h-64 overflow-y-auto border rounded-md p-2 space-y-2">
                          {selectedPapers.map((paper, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                              <span className="text-sm truncate flex-1 mr-2">{paper.name}</span>
                              <Button variant="ghost" size="sm" onClick={() => removePaper(index)}>
                                <span className="text-xs">Remove</span>
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedPapers([]);
                          setPaperDialogOpen(false);
                        }}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleUploadPapers}
                        className="flex-1"
                        disabled={isPaperLoading || selectedPapers.length === 0}
                      >
                        {isPaperLoading ? <LoadingSpinner /> : 'Process Papers & Extract Questions'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardFooter>
          </Card>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold font-headline flex items-center gap-2"><BookCopy /> Paper Types</h2>
          <div className="flex items-center gap-2">
            <Switch
              id="hide-empty-papers"
              checked={hideEmptyPapers}
              onCheckedChange={setHideEmptyPapers}
            />
            <Label htmlFor="hide-empty-papers" className="text-sm">Hide papers without questions</Label>
          </div>
        </div>
        {filteredPaperTypes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPaperTypes.map(paperType => {
              const avgScore = getPaperTypeAverageScore(paperType);
              const hasScore = avgScore !== null;

              return (
                <Card
                  key={paperType.id}
                  className="hover:shadow-[0_0_0_4px_white] transition-all cursor-pointer h-full border-2"
                  style={hasScore ? getScoreColorStyle(avgScore) : getDefaultBoxStyle()}
                  onClick={() => handleNavigate(paperType.id)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg text-black">{paperType.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-black">{paperType.topics.length} topics</p>
                      {hasScore && (
                        <p className="text-sm font-bold text-black">{avgScore.toFixed(1)}%</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <h3 className="text-lg font-semibold">No paper types found</h3>
              <p className="text-muted-foreground mt-1">This subject has no paper types.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
