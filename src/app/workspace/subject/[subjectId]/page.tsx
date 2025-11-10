"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext } from '@/app/context/AppContext';
import { AuthGuard } from '@/components/AuthGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import PageSpinner from '@/components/PageSpinner';
import { ArrowLeft, BookCopy, FileText, Crown } from 'lucide-react';
import { getScoreColorStyle, getDefaultBoxStyle, getUnattemptedBoxStyle } from '@/lib/utils';
import { PaperType } from '@/lib/types';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { SubjectNameDescriptionModal } from '@/components/SubjectNameDescriptionModal';
import { UnderstandingIndicator } from '@/components/ui/understanding-indicator';

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
  const { subjects, processExamPapers, processMarkschemes, isLoading, setLoading } = useAppContext();
  const subjectId = params.subjectId as string;
  const subject = subjects.find(s => s.id === subjectId);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  const [hideEmptyPapers, setHideEmptyPapers] = useState(true);
  const [isNameDescModalOpen, setNameDescModalOpen] = useState(false);

  useEffect(() => {
    // Reset loading state on mount in case user navigated back
    if (subject) {
      setLoading(`navigate-${subject.id}`, false);
      subject.paperTypes.forEach(pt => setLoading(`navigate-paper-${pt.id}`, false));
    }
  }, [subject, setLoading]);

  useEffect(() => {
    // Auto-open name/description modal for new subjects (description is null)
    if (subject && subject.description === null) {
      setNameDescModalOpen(true);
    }
  }, [subject]);

  const handleNavigate = (paperTypeId: string) => {
    setLoading(`navigate-paper-${paperTypeId}`, true);
    setNavigatingTo(paperTypeId);
    router.push(`/workspace/subject/${subjectId}/paper/${paperTypeId}`);
  };
  
  if (navigatingTo && isLoading(`navigate-paper-${navigatingTo}`)) {
    return <PageSpinner />;
  }

  // Show loading spinner while subjects are being fetched
  if (isLoading('fetch-subjects')) {
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

  // Calculate average score for a paper type based only on attempted topics
  const getPaperTypeAverageScore = (paperType: PaperType): number | null => {
    const topicsWithQuestions = paperType.topics.filter(t => t.examQuestions && t.examQuestions.length > 0);
    if (topicsWithQuestions.length === 0) return null;

    let topicScoresSum = 0;
    let attemptedTopicsCount = 0;

    for (const topic of topicsWithQuestions) {
      const attemptedQuestions = topic.examQuestions.filter(q => q.attempts > 0);
      if (attemptedQuestions.length > 0) {
        // Calculate topic average from attempted questions only
        const topicScore = attemptedQuestions.reduce((acc, q) => acc + q.score, 0) / attemptedQuestions.length;
        topicScoresSum += topicScore;
        attemptedTopicsCount++;
      }
    }

    if (attemptedTopicsCount === 0) return null;
    return topicScoresSum / attemptedTopicsCount;
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

      {/* Syllabus Info - Only show for creators */}
      {subject.isCreator && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText /> Syllabus Info</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-green-600">Syllabus uploaded and {subject.paperTypes.length} paper types identified.</p>
            <p className="text-sm text-muted-foreground mt-2">To upload past papers or markschemes, click on a paper type below.</p>
          </CardContent>
        </Card>
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
              const hasQuestions = paperTypeHasQuestions(paperType);

              // Calculate progress
              const allQuestions = paperType.topics.flatMap(t => t.examQuestions || []);
              const totalQuestions = allQuestions.length;
              const attemptedQuestions = allQuestions.filter(q => q.attempts > 0).length;
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
                <Card
                  key={paperType.id}
                  className="hover:shadow-[0_0_0_4px_rgb(55,65,81)] dark:hover:shadow-[0_0_0_4px_white] transition-all cursor-pointer h-full border-2"
                  style={boxStyle}
                  onClick={() => handleNavigate(paperType.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <CardTitle className="text-lg text-black flex-1">{paperType.name}</CardTitle>
                      {hasScore && (
                        <UnderstandingIndicator percentage={avgScore} size="sm" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-black">{totalQuestions > 0 ? `${attemptedQuestions}/${totalQuestions} attempted` : `${paperType.topics.length} topics`}</p>
                    {totalQuestions > 0 && (
                      <Progress value={progressPercentage} className="h-2" />
                    )}
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

      {/* Subject Name and Description Modal */}
      <SubjectNameDescriptionModal
        subjectId={subject.id}
        initialName={subject.name}
        isOpen={isNameDescModalOpen}
        onClose={() => setNameDescModalOpen(false)}
      />
    </div>
  );
}
