"use client";

import { ChangeEvent, useRef, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext } from '@/app/context/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import LoadingSpinner from '@/components/LoadingSpinner';
import PageSpinner from '@/components/PageSpinner';
import { FileText, Upload, List, ArrowLeft, BookCopy } from 'lucide-react';
import { Topic } from '@/lib/types';

export default function PaperTypePage() {
  const params = useParams();
  const router = useRouter();
  const { getSubjectById, processExamPapers, isLoading, setLoading } = useAppContext();
  
  const subjectId = params.subjectId as string;
  const paperTypeId = decodeURIComponent(params.paperTypeId as string);
  
  const subject = getSubjectById(subjectId);
  const paperType = subject?.paperTypes.find(p => p.id === paperTypeId);

  const paperInputRef = useRef<HTMLInputElement>(null);
  const [isPaperDialogOpen, setPaperDialogOpen] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [selectedPapers, setSelectedPapers] = useState<File[]>([]);

  useEffect(() => {
    // Reset loading state on mount in case user navigated back
    if (paperType) {
       paperType.topics.forEach(topic => setLoading(`navigate-topic-${topic.id}`, false));
    }
  }, [paperType, setLoading]);

  const handlePaperSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedPapers(prev => [...prev, ...files]);
  };

  const removePaper = (index: number) => {
    setSelectedPapers(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadPapers = async () => {
    if (selectedPapers.length > 0 && subject) {
      await processExamPapers(subject.id, selectedPapers);
      setSelectedPapers([]);
      setPaperDialogOpen(false);
    }
  };
  
  const handleNavigate = (topicId: string) => {
    const loadingKey = `navigate-topic-${topicId}`;
    setLoading(loadingKey, true);
    setNavigatingTo(topicId);
    // Let the Link component handle navigation
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
                  <DialogTitle>Upload Past Papers</DialogTitle>
                  <DialogDescription>
                    Upload exam papers to automatically extract questions for all topics in "{subject.name}".
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                      Questions will be automatically extracted and sorted into topics.
                    </p>
                  </div>

                  {subject.pastPapers.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Previously Uploaded:</h4>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {subject.pastPapers.map(paper => (
                          <div key={paper.id} className="text-xs p-2 bg-secondary rounded-md">{paper.name}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <Button onClick={() => paperInputRef.current?.click()} variant="outline" className="w-full">
                      <Upload className="mr-2 h-4 w-4" />
                      Select Papers to Upload
                    </Button>
                    <Input
                      type="file"
                      ref={paperInputRef}
                      className="hidden"
                      onChange={handlePaperSelect}
                      accept=".pdf,.txt,.md"
                      multiple
                    />

                    {selectedPapers.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {selectedPapers.map((paper, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                            <span>{paper.name}</span>
                            <Button variant="ghost" size="sm" onClick={() => removePaper(index)}>
                              <span className="text-xs">Remove</span>
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={handleUploadPapers}
                    className="w-full"
                    disabled={isPaperLoading || selectedPapers.length === 0}
                  >
                    {isPaperLoading ? <LoadingSpinner /> : 'Process Papers & Extract Questions'}
                  </Button>
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
               <Link key={topic.id} href={`/subject/${subjectId}/paper/${encodeURIComponent(paperTypeId)}/topic/${encodeURIComponent(topic.id)}`} onClick={() => handleNavigate(topic.id)} className="block hover:no-underline">
                <Card className="hover:bg-secondary transition-colors h-full">
                    <CardHeader>
                      <CardTitle className="text-lg">{topic.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{topic.examQuestions?.length > 0 ? `${topic.examQuestions.length} questions` : 'No questions yet'}</p>
                    </CardContent>
                  </Card>
               </Link>
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
