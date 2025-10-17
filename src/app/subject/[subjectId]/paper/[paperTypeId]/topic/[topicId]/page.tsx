"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext } from '@/app/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import PageSpinner from '@/components/PageSpinner';

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
       Object.values(topic.subsections).forEach(sub => setLoading(`navigate-subsection-${sub.id}`, false));
    }
  }, [topic, setLoading]);


  const handleNavigate = (subsectionId: string) => {
    const loadingKey = `navigate-subsection-${subsectionId}`;
    setLoading(loadingKey, true);
    setNavigatingTo(subsectionId);
    router.push(`/subject/${subjectId}/paper/${encodeURIComponent(paperTypeId)}/topic/${encodeURIComponent(topicId)}/subsection/${encodeURIComponent(subsectionId)}`);
  };

  if (navigatingTo && isLoading(`navigate-subsection-${navigatingTo}`)) {
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
      <p className="text-muted-foreground mb-8">Select a subsection to start practicing.</p>

      {topic.subsections.length > 0 ? (
        <div className="space-y-3">
          {topic.subsections.map(subsection => (
              <Card key={subsection.id} className="hover:bg-secondary transition-colors cursor-pointer" onClick={() => handleNavigate(subsection.id)}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-md font-medium">{subsection.name}</CardTitle>
                  <div className="text-right">
                    <div className="text-sm font-bold text-primary">{subsection.score.toFixed(1)}%</div>
                    {subsection.attempts > 0 && (
                      <div className="text-xs text-muted-foreground">{subsection.attempts} attempt{subsection.attempts !== 1 ? 's' : ''}</div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Progress value={subsection.score} className="h-2" />
                </CardContent>
              </Card>
          ))}
        </div>
      ) : (
         <Card className="text-center py-12">
            <CardContent>
              <h3 className="text-lg font-semibold">No subsections generated</h3>
              <p className="text-muted-foreground mt-1">The AI might not have been able to break down this topic.</p>
            </CardContent>
          </Card>
      )}
    </div>
  );
}
