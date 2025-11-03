"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext } from '@/app/context/AppContext';
import { AuthGuard } from '@/components/AuthGuard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import PageSpinner from '@/components/PageSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getScoreColorStyle, getUnattemptedBoxStyle } from '@/lib/utils';

export default function TopicPage() {
  return (
    <AuthGuard>
      <TopicPageContent />
    </AuthGuard>
  );
}

function TopicPageContent() {
  const params = useParams();
  const router = useRouter();
  const { subjects, isLoading, setLoading } = useAppContext();

  const subjectId = params.subjectId as string;
  const paperTypeId = decodeURIComponent(params.paperTypeId as string);
  const topicId = decodeURIComponent(params.topicId as string);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  // Directly access subjects to ensure component re-renders when subjects change
  const subject = subjects.find(s => s.id === subjectId);
  const paperType = subject?.paperTypes.find(pt => pt.id === paperTypeId);
  const topic = paperType?.topics.find(t => t.id === topicId);

  useEffect(() => {
    // Reset loading state on mount in case user navigated back
    if (topic) {
       Object.values(topic.examQuestions).forEach(q => setLoading(`navigate-question-${q.id}`, false));
    }
  }, [topic, setLoading]);


  const handleNavigate = (questionId: string) => {
    const loadingKey = `navigate-question-${questionId}`;
    setLoading(loadingKey, true);
    setNavigatingTo(questionId);
    router.push(`/subject/${subjectId}/paper/${encodeURIComponent(paperTypeId)}/topic/${encodeURIComponent(topicId)}/question/${encodeURIComponent(questionId)}`);
  };

  if (navigatingTo && isLoading(`navigate-question-${navigatingTo}`)) {
    return <PageSpinner />;
  }

  // Show loading spinner while subjects are being fetched
  if (isLoading('fetch-subjects')) {
    return <PageSpinner />;
  }

  if (!subject || !topic) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">Topic not found</h1>
        <Button asChild variant="link" className="mt-4">
          <Link href={`/subject/${subjectId}/paper/${encodeURIComponent(paperTypeId)}`}>Go back to paper</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <Button variant="ghost" onClick={() => router.push(`/subject/${subjectId}/paper/${encodeURIComponent(paperTypeId)}`)} className="mb-4">
        <ArrowLeft />
        Back to Topics
      </Button>
      <h1 className="text-3xl font-bold font-headline mb-2">{topic.name}</h1>

      {/* Topic Description Info Block */}
      {topic.description && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Topic Overview</AlertTitle>
          <AlertDescription>{topic.description}</AlertDescription>
        </Alert>
      )}

      <p className="text-muted-foreground mb-8">Select a question to start practicing.</p>

      {(() => {
        // Filter to only show questions with objectives
        const questionsWithObjectives = topic.examQuestions.filter(q =>
          q.solutionObjectives && q.solutionObjectives.length > 0
        );

        return questionsWithObjectives.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {questionsWithObjectives.map(question => {
            const hasAttempts = question.attempts > 0;
            const boxStyle = hasAttempts ? getScoreColorStyle(question.score) : getUnattemptedBoxStyle();

            return (
              <Card
                key={question.id}
                className="hover:shadow-[0_0_0_4px_rgb(55,65,81)] dark:hover:shadow-[0_0_0_4px_white] transition-all cursor-pointer h-full border-2"
                style={boxStyle}
                onClick={() => handleNavigate(question.id)}
              >
                <CardHeader>
                  <CardTitle className="text-lg text-black">{question.summary}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    {hasAttempts ? (
                      <>
                        <p className="text-sm text-black">{question.attempts} attempt{question.attempts !== 1 ? 's' : ''}</p>
                        <p className="text-sm font-bold text-black">{question.score.toFixed(1)}%</p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-600">Not attempted</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
         <Card className="text-center py-12 border-2 border-dashed">
            <CardContent>
              <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Questions with Markschemes Available</h3>
              <p className="text-muted-foreground mb-4">
                Questions can only be practiced if they have been extracted with a markscheme. To practice questions for this topic, please upload exam papers along with their corresponding markschemes.
              </p>
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 max-w-md mx-auto">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Tip:</strong> Upload both exam papers and markschemes via the "Manage Past Papers" button on the paper type page. Questions without markschemes cannot be practiced.
                </p>
              </div>
            </CardContent>
          </Card>
      );
      })()}
    </div>
  );
}
