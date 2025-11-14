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
  const { loadSubjectsList, loadPaperTypes, loadTopics, isLoading, setLoading, cacheVersion } = useAppContext();

  const subjectId = params.subjectId as string;
  const paperTypeId = decodeURIComponent(params.paperTypeId as string);

  const [subject, setSubject] = useState<import('@/app/context/AppContext').SubjectPreview | null>(null);
  const [paperType, setPaperType] = useState<import('@/app/context/AppContext').PaperTypeWithMetrics | null>(null);
  const [topics, setTopics] = useState<import('@/app/context/AppContext').TopicWithMetrics[]>([]);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [hideEmptyTopics, setHideEmptyTopics] = useState(true);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const subjectsList = await loadSubjectsList();
        const foundSubject = subjectsList.find(s => s.id === subjectId);
        setSubject(foundSubject || null);

        const paperTypesList = await loadPaperTypes(subjectId);
        const foundPaperType = paperTypesList.find(pt => pt.id === paperTypeId);
        setPaperType(foundPaperType || null);

        if (foundPaperType) {
          const topicsList = await loadTopics(paperTypeId);
          setTopics(topicsList);
        }
      } catch (error) {
        console.error('Error loading paper type data:', error);
      }
    };

    loadData();
  }, [subjectId, paperTypeId, loadSubjectsList, loadPaperTypes, loadTopics, cacheVersion]);

  useEffect(() => {
    // Reset loading state on mount in case user navigated back
    topics.forEach(topic => setLoading(`navigate-topic-${topic.id}`, false));
  }, [topics, setLoading]);

  const handleNavigate = (topicId: string) => {
    const loadingKey = `navigate-topic-${topicId}`;
    setLoading(loadingKey, true);
    setNavigatingTo(topicId);
    // Let the Link component handle navigation
  };

  if (navigatingTo && isLoading(`navigate-topic-${navigatingTo}`)) {
    return <PageSpinner />;
  }

  // Show loading spinner while data is being fetched
  if (isLoading(`load-topics-${paperTypeId}`)) {
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

  // Filter topics based on toggle (using metrics from API)
  const filteredTopics = hideEmptyTopics
    ? topics.filter(topic => topic.total_questions > 0)
    : topics;

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
            {filteredTopics.map((topic) => {
              // Use metrics from API (already calculated server-side)
              const avgScore = topic.avg_score;
              const hasScore = avgScore !== null && topic.attempted_questions > 0;
              const hasQuestions = topic.total_questions > 0;
              const progressPercentage = topic.total_questions > 0
                ? (topic.attempted_questions / topic.total_questions) * 100
                : 0;

              // Determine which style to use
              let boxStyle;
              if (hasScore && avgScore !== null) {
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
                        {hasScore && avgScore !== null && (
                          <UnderstandingIndicator percentage={avgScore} size="sm" />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm text-black">
                        {hasQuestions ? `${topic.attempted_questions}/${topic.total_questions} attempted` : 'No questions yet'}
                      </p>
                      {hasQuestions && (
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
