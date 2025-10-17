"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext } from '@/app/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import PageSpinner from '@/components/PageSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function TopicPage() {
  const params = useParams();
  const router = useRouter();
  const { getSubjectById, isLoading, setLoading } = useAppContext();

  const subjectId = params.subjectId as string;
  const paperTypeId = decodeURIComponent(params.paperTypeId as string);
  const topicId = decodeURIComponent(params.topicId as string);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  const subject = getSubjectById(subjectId);
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

      {topic.examQuestions.length > 0 ? (
        <div className="space-y-3">
          {topic.examQuestions.map(question => (
              <Card key={question.id} className="hover:bg-secondary transition-colors cursor-pointer" onClick={() => handleNavigate(question.id)}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex-1">
                    <CardTitle className="text-md font-medium">{question.summary}</CardTitle>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-sm font-bold text-primary">{question.score.toFixed(1)}%</div>
                    {question.attempts > 0 && (
                      <div className="text-xs text-muted-foreground">{question.attempts} attempt{question.attempts !== 1 ? 's' : ''}</div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Progress value={question.score} className="h-2" />
                </CardContent>
              </Card>
          ))}
        </div>
      ) : (
         <Card className="text-center py-12 border-2 border-dashed">
            <CardContent>
              <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Exam Questions Available</h3>
              <p className="text-muted-foreground mb-4">
                Questions are extracted from real past exam papers. To practice questions for this topic, please upload at least one exam paper.
              </p>
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 max-w-md mx-auto">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Tip:</strong> Upload exam papers via the "Manage Past Papers" button on the paper type page, then questions will be automatically extracted and categorized.
                </p>
              </div>
            </CardContent>
          </Card>
      )}
    </div>
  );
}
