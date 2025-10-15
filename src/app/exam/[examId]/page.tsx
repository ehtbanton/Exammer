"use client";

import { ChangeEvent, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext } from '@/app/context/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import LoadingSpinner from '@/components/LoadingSpinner';
import PageSpinner from '@/components/PageSpinner';
import { FileText, Upload, List, ArrowLeft, BookCopy } from 'lucide-react';
import { Topic } from '@/lib/types';

export default function PaperTypePage() {
  const params = useParams();
  const router = useRouter();
  const { getSubjectById, addPastPaperToSubject, isLoading, setLoading } = useAppContext();
  
  const subjectId = params.subjectId as string;
  const paperTypeId = params.paperTypeId as string;
  
  const subject = getSubjectById(subjectId);
  const paperType = subject?.paperTypes.find(p => p.id === paperTypeId);

  const paperInputRef = useRef<HTMLInputElement>(null);
  const [isPaperDialogOpen, setPaperDialogOpen] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  
  const handlePaperUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && subject) {
      addPastPaperToSubject(subject.id, file).then(() => {
        setPaperDialogOpen(true);
      });
    }
  };
  
  const handleNavigate = (topicId: string) => {
    const loadingKey = `navigate-topic-${topicId}`;
    setLoading(loadingKey, true);
    setNavigatingTo(topicId);
    router.push(`/subject/${subjectId}/paper/${paperTypeId}/topic/${topicId}`);
  };

  if (navigatingTo && isLoading(`navigate-topic-${navigatingTo}`)) {
    return <PageSpinner />;
  }

  if (!subject || !paperType) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">Paper Type not found</h1>
        <Button asChild variant="link" className="mt-4">
          <Link href={`/subject/${subjectId}`}>Go back to subject</Link>
        </Button>
      </div>
    );
  }

  const isPaperLoading = isLoading(`paper-${subject.id}`);

  return (
    <div className="container mx-auto">
      <Button variant="ghost" onClick={() => router.push(`/subject/${subjectId}`)} className="mb-4">
        <ArrowLeft />
        Back to Paper Types
      </Button>
      <h1 className="text-3xl font-bold font-headline mb-2">{paperType.name}</h1>
      <p className="text-muted-foreground mb-8">Topics for {subject.name}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText /> Syllabus Info</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-green-600">Syllabus uploaded and {subject.paperTypes.length} paper types identified.</p>
          </CardContent>
        </Card>
        
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><List /> Past Papers</CardTitle>
            <CardDescription>Upload past exam papers for the whole subject for better question generation.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{subject.pastPapers.length} paper(s) uploaded.</p>
          </CardContent>
          <CardFooter>
            <Dialog open={isPaperDialogOpen} onOpenChange={setPaperDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary">Manage Past Papers</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Past Papers</DialogTitle>
                  <DialogDescription>
                    View and upload past papers for "{subject.name}".
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4 max-h-60 overflow-y-auto pr-2">
                  {subject.pastPapers.length > 0 ? (
                    <ul className="space-y-2">
                      {subject.pastPapers.map(paper => (
                        <li key={paper.id} className="text-sm p-2 bg-secondary rounded-md">{paper.name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-center text-muted-foreground py-4">No papers uploaded.</p>
                  )}
                </div>
                <div className="mt-4">
                  <Button onClick={() => paperInputRef.current?.click()} className="w-full" disabled={isPaperLoading}>
                    {isPaperLoading ? <LoadingSpinner /> : <Upload />}
                    Upload New Paper
                  </Button>
                  <Input type="file" ref={paperInputRef} className="hidden" onChange={handlePaperUpload} />
                </div>
              </DialogContent>
            </Dialog>
          </CardFooter>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-bold font-headline mb-4 flex items-center gap-2"><BookCopy /> Topics</h2>
        {paperType.topics.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paperType.topics.map((topic: Topic) => (
               <Card key={topic.id} className="hover:bg-secondary transition-colors cursor-pointer h-full" onClick={() => handleNavigate(topic.id)}>
                  <CardHeader>
                    <CardTitle className="text-lg">{topic.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                     <p className="text-sm text-muted-foreground">{topic.subsections.length > 0 ? `${topic.subsections.length} subsections` : 'Click to generate subsections'}</p>
                  </CardContent>
                </Card>
            ))}
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
