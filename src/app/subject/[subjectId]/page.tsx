"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext } from '@/app/context/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageSpinner from '@/components/PageSpinner';
import { ArrowLeft, BookCopy } from 'lucide-react';

export default function SubjectPage() {
  const params = useParams();
  const router = useRouter();
  const { getSubjectById, isLoading, setLoading } = useAppContext();
  const subjectId = params.subjectId as string;
  const subject = getSubjectById(subjectId);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  useEffect(() => {
    // Reset loading state on mount in case user navigated back
    if (subject) {
      setLoading(`navigate-${subject.id}`, false);
      subject.paperTypes.forEach(pt => setLoading(`navigate-paper-${pt.id}`, false));
    }
  }, [subject, setLoading]);
  
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

  return (
    <div className="container mx-auto">
      <Button variant="ghost" onClick={() => router.push('/')} className="mb-4">
        <ArrowLeft />
        Back to Subjects
      </Button>
      <h1 className="text-3xl font-bold font-headline mb-8">{subject.name}</h1>

      <div>
        <h2 className="text-2xl font-bold font-headline mb-4 flex items-center gap-2"><BookCopy /> Paper Types</h2>
        {subject.paperTypes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subject.paperTypes.map(paperType => (
                <Card key={paperType.id} className="hover:bg-secondary transition-colors cursor-pointer h-full" onClick={() => handleNavigate(paperType.id)}>
                  <CardHeader>
                    <CardTitle className="text-lg">{paperType.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                     <p className="text-sm text-muted-foreground">{paperType.topics.length} topics</p>
                  </CardContent>
                </Card>
            ))}
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
