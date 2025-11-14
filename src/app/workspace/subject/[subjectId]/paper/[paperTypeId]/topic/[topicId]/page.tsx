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
import { UnderstandingIndicator } from '@/components/ui/understanding-indicator';

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
  const { loadTopics, loadQuestions, isLoading, setLoading, cacheVersion } = useAppContext();

  const subjectId = params.subjectId as string;
  const paperTypeId = decodeURIComponent(params.paperTypeId as string);
  const topicId = decodeURIComponent(params.topicId as string);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [topic, setTopic] = useState<import('@/app/context/AppContext').TopicWithMetrics | null>(null);
  const [questions, setQuestions] = useState<import('@/app/context/AppContext').QuestionPreview[]>([]);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const topicsList = await loadTopics(paperTypeId);
        const foundTopic = topicsList.find(t => t.id === topicId);
        setTopic(foundTopic || null);

        if (foundTopic) {
          const questionsList = await loadQuestions(topicId);
          setQuestions(questionsList);
        }
      } catch (error) {
        console.error('Error loading topic data:', error);
      }
    };

    loadData();
  }, [paperTypeId, topicId, loadTopics, loadQuestions, cacheVersion]);

  useEffect(() => {
    // Reset loading state on mount in case user navigated back
    questions.forEach(q => setLoading(`navigate-question-${q.id}`, false));
  }, [questions, setLoading]);


  const handleNavigate = (questionId: string) => {
    const loadingKey = `navigate-question-${questionId}`;
    setLoading(loadingKey, true);
    setNavigatingTo(questionId);
    router.push(`/workspace/subject/${subjectId}/paper/${encodeURIComponent(paperTypeId)}/topic/${encodeURIComponent(topicId)}/question/${encodeURIComponent(questionId)}`);
  };

  if (navigatingTo && isLoading(`navigate-question-${navigatingTo}`)) {
    return <PageSpinner />;
  }

  // Show loading spinner while data is being fetched
  if (isLoading(`load-questions-${topicId}`)) {
    return <PageSpinner />;
  }

  if (!topic) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">Topic not found</h1>
        <Button asChild variant="link" className="mt-4">
          <Link href={`/workspace/subject/${subjectId}/paper/${encodeURIComponent(paperTypeId)}`}>Go back to paper</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <Button variant="ghost" onClick={() => router.push(`/workspace/subject/${subjectId}/paper/${encodeURIComponent(paperTypeId)}`)} className="mb-4">
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

      {questions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {questions.map(question => {
            const hasAttempts = question.attempts > 0;
            const hasMarkscheme = question.has_markscheme === 1;
            const boxStyle = hasAttempts ? getScoreColorStyle(question.score) : getUnattemptedBoxStyle();

            return (
              <Card
                key={question.id}
                className="hover:shadow-[0_0_0_4px_rgb(55,65,81)] dark:hover:shadow-[0_0_0_4px_white] transition-all cursor-pointer h-full border-2"
                style={boxStyle}
                onClick={() => handleNavigate(question.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <CardTitle className="text-lg text-black flex items-center gap-2 flex-1">
                      {question.summary}
                      {!hasMarkscheme && (
                        <span className="inline-flex items-center text-xs font-normal px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 rounded">
                          No MS
                        </span>
                      )}
                    </CardTitle>
                    {hasAttempts && (
                      <UnderstandingIndicator percentage={question.score} size="sm" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-black">{question.attempts} attempt{question.attempts !== 1 ? 's' : ''}</p>
                  {!hasAttempts && (
                    <p className="text-sm text-gray-600">Not attempted</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
         <Card className="text-center py-12 border-2 border-dashed">
            <CardContent>
              <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Questions Available</h3>
              <p className="text-muted-foreground mb-4">
                No questions have been extracted for this topic yet. Upload exam papers to get started.
              </p>
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 max-w-md mx-auto">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Tip:</strong> Upload exam papers via the "Add All Past Papers" button on the subject page. You can optionally upload markschemes later to enable objective-based grading.
                </p>
              </div>
            </CardContent>
          </Card>
      )}
    </div>
  );
}
