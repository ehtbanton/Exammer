"use client";

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext } from '@/app/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';

export default function TopicPage() {
  const params = useParams();
  const router = useRouter();
  const { getExamById, setSubsectionsForTopic, isLoading } = useAppContext();
  
  const examId = params.examId as string;
  const topicId = params.topicId as string;

  const exam = getExamById(examId);
  const topic = exam?.topics.find(t => t.id === topicId);

  useEffect(() => {
    if (exam && topic && topic.subsections.length === 0) {
      setSubsectionsForTopic(exam.id, topic.name);
    }
  }, [exam, topic, setSubsectionsForTopic]);

  if (!exam || !topic) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">Topic not found</h1>
        <Button asChild variant="link" className="mt-4">
          <Link href={`/exam/${examId}`}>Go back to exam</Link>
        </Button>
      </div>
    );
  }
  
  const isSubsectionsLoading = isLoading(`subsections-${exam.id}-${topic.name}`);

  return (
    <div className="container mx-auto">
      <Button variant="ghost" onClick={() => router.push(`/exam/${examId}`)} className="mb-4">
        <ArrowLeft />
        Back to Topics
      </Button>
      <h1 className="text-3xl font-bold font-headline mb-2">{topic.name}</h1>
      <p className="text-muted-foreground mb-8">Select a subsection to start practicing.</p>
      
      {isSubsectionsLoading && topic.subsections.length === 0 ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
             <Card key={i}>
                <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-4 w-full" />
                </CardContent>
             </Card>
          ))}
        </div>
      ) : topic.subsections.length > 0 ? (
        <div className="space-y-3">
          {topic.subsections.map(subsection => (
            <Link key={subsection.id} href={`/exam/${exam.id}/topic/${topic.id}/subsection/${subsection.id}`} passHref>
              <Card className="hover:bg-secondary transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-md font-medium">{subsection.name}</CardTitle>
                  <span className="text-sm font-bold text-primary">{subsection.score}/100</span>
                </CardHeader>
                <CardContent>
                  <Progress value={subsection.score} className="h-2" />
                </CardContent>
              </Card>
            </Link>
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
