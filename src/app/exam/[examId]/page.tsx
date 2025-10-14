"use client";

import { ChangeEvent, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext } from '@/app/context/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import LoadingSpinner from '@/components/LoadingSpinner';
import { FileText, Upload, List, ArrowLeft } from 'lucide-react';

export default function ExamPage() {
  const params = useParams();
  const router = useRouter();
  const { getExamById, addSyllabusToExam, addPastPaperToExam, isLoading } = useAppContext();
  const examId = params.examId as string;
  const exam = getExamById(examId);

  const syllabusInputRef = useRef<HTMLInputElement>(null);
  const paperInputRef = useRef<HTMLInputElement>(null);
  const [isPaperDialogOpen, setPaperDialogOpen] = useState(false);

  const handleSyllabusUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && exam) {
      addSyllabusToExam(exam.id, file);
    }
  };

  const handlePaperUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && exam) {
      addPastPaperToExam(exam.id, file).then(() => {
        // Keeps the dialog open to see the new file
        setPaperDialogOpen(true);
      });
    }
  };

  if (!exam) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">Exam not found</h1>
        <Button asChild variant="link" className="mt-4">
          <Link href="/">Go back to exams</Link>
        </Button>
      </div>
    );
  }

  const isSyllabusLoading = isLoading(`syllabus-${exam.id}`);
  const isPaperLoading = isLoading(`paper-${exam.id}`);

  return (
    <div className="container mx-auto">
      <Button variant="ghost" onClick={() => router.push('/')} className="mb-4">
        <ArrowLeft />
        Back to Exams
      </Button>
      <h1 className="text-3xl font-bold font-headline mb-8">{exam.name}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText /> Syllabus</CardTitle>
            <CardDescription>Upload the exam syllabus to generate topics.</CardDescription>
          </CardHeader>
          <CardContent>
            {exam.topics.length > 0 ? (
              <p className="text-green-600">Syllabus uploaded and {exam.topics.length} topics identified.</p>
            ) : (
              <p className="text-muted-foreground">No syllabus uploaded yet.</p>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={() => syllabusInputRef.current?.click()} disabled={isSyllabusLoading}>
              {isSyllabusLoading ? <LoadingSpinner /> : <Upload />}
              {exam.topics.length > 0 ? 'Re-upload Syllabus' : 'Upload Syllabus'}
            </Button>
            <Input type="file" accept=".pdf" ref={syllabusInputRef} className="hidden" onChange={handleSyllabusUpload} />
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><List /> Past Papers</CardTitle>
            <CardDescription>Upload past exam papers for better question generation.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{exam.pastPapers.length} paper(s) uploaded.</p>
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
                    View and upload past papers for "{exam.name}".
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4 max-h-60 overflow-y-auto pr-2">
                  {exam.pastPapers.length > 0 ? (
                    <ul className="space-y-2">
                      {exam.pastPapers.map(paper => (
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
        <h2 className="text-2xl font-bold font-headline mb-4">Topics</h2>
        {exam.topics.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {exam.topics.map(topic => (
              <Link key={topic.id} href={`/exam/${exam.id}/topic/${topic.id}`} passHref>
                <Card className="hover:bg-secondary transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <CardTitle className="text-lg">{topic.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                     <p className="text-sm text-muted-foreground">{topic.subsections.length > 0 ? `${topic.subsections.length} subsections` : 'Click to generate subsections'}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <h3 className="text-lg font-semibold">No topics found</h3>
              <p className="text-muted-foreground mt-1">Upload a syllabus to get started.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
