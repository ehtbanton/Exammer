"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext } from '@/app/context/AppContext';
import { AuthGuard } from '@/components/AuthGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import PageSpinner from '@/components/PageSpinner';
import { ArrowLeft, BookCopy } from 'lucide-react';
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
  const { subjects, isLoading, setLoading } = useAppContext();

  const subjectId = params.subjectId as string;
  const paperTypeId = decodeURIComponent(params.paperTypeId as string);

  const subject = subjects.find(s => s.id === subjectId);
  const paperType = subject?.paperTypes.find(p => p.id === paperTypeId);

  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [hideEmptyTopics, setHideEmptyTopics] = useState(true);

  useEffect(() => {
    // Reset loading state on mount in case user navigated back
    if (paperType) {
       paperType.topics.forEach(topic => setLoading(`navigate-topic-${topic.id}`, false));
    }
  }, [paperType, setLoading]);

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

  return (
    <div className="container mx-auto">
      <Button variant="ghost" onClick={() => router.push(`/workspace/subject/${subjectId}`)} className="mb-4">
        <ArrowLeft />
        Back to Paper Types
      </Button>
      <h1 className="text-3xl font-bold font-headline mb-2">{paperType.name}</h1>
      <p className="text-muted-foreground mb-8">Topics for {subject.name}</p>

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
