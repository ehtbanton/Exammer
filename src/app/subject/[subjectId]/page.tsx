"use client";

import { ChangeEvent, useRef, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext } from '@/app/context/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import LoadingSpinner from '@/components/LoadingSpinner';
import PageSpinner from '@/components/PageSpinner';
import { FileText, Upload, ArrowLeft, BookCopy } from 'lucide-react';

export default function SubjectPage() {
  const params = useParams();
  const router = useRouter();
  const { getSubjectById, addSyllabusToSubject, isLoading, setLoading } = useAppContext();
  const subjectId = params.subjectId as string;
  const subject = getSubjectById(subjectId);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  const syllabusInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Reset loading state on mount in case user navigated back
    if (subject) {
      setLoading(`navigate-${subject.id}`, false);
    }
  }, [subject, setLoading]);


  const handleSyllabusUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && subject) {
      addSyllabusToSubject(subject.id, file);
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

  const isSyllabusLoading = isLoading(`syllabus-${subject.id}`);

  return (
    <div className="container mx-auto">
      <Button variant="ghost" onClick={() => router.push('/')} className="mb-4">
        <ArrowLeft />
        Back to Subjects
      </Button>
      <h1 className="text-3xl font-bold font-headline mb-8">{subject.name}</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText /> Syllabus</CardTitle>
          <CardDescription>Upload the subject syllabus to identify the different exam papers and their topics.</CardDescription>
        </CardHeader>
        <CardContent>
          {subject.paperTypes.length > 0 ? (
            <p className="text-green-600">Syllabus uploaded and {subject.paperTypes.length} paper types identified.</p>
          ) : (
            <p className="text-muted-foreground">No syllabus uploaded yet.</p>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={() => syllabusInputRef.current?.click()} disabled={isSyllabusLoading}>
            {isSyllabusLoading ? <LoadingSpinner /> : <Upload />}
            {subject.paperTypes.length > 0 ? 'Re-upload Syllabus' : 'Upload Syllabus'}
          </Button>
          <Input type="file" accept=".pdf,.txt,.md" ref={syllabusInputRef} className="hidden" onChange={handleSyllabusUpload} />
        </CardFooter>
      </Card>

      <div>
        <h2 className="text-2xl font-bold font-headline mb-4 flex items-center gap-2"><BookCopy /> Paper Types</h2>
        {isSyllabusLoading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                    <Card key={i}><CardHeader><CardTitle>Processing...</CardTitle></CardHeader><CardContent><LoadingSpinner/></CardContent></Card>
                ))}
             </div>
        ) : subject.paperTypes.length > 0 ? (
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
              <p className="text-muted-foreground mt-1">Upload a syllabus to get started.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
