"use client";

import { ChangeEvent, useRef, useState } from 'react';
import Link from 'next/link';
import { useAppContext } from '@/app/context/AppContext';
import { AuthGuard } from '@/components/AuthGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Upload, Trash2, BookOpen, FileText } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import PageSpinner from '@/components/PageSpinner';

export default function HomePage() {
  return (
    <AuthGuard>
      <HomePageContent />
    </AuthGuard>
  );
}

function HomePageContent() {
  const { subjects, createSubjectFromSyllabus, processExamPapers, deleteSubject, isLoading, setLoading } = useAppContext();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const [uploadStage, setUploadStage] = useState<'initial' | 'syllabus' | 'papers'>('initial');
  const [examPapers, setExamPapers] = useState<File[]>([]);
  const syllabusInputRef = useRef<HTMLInputElement>(null);
  const examPapersInputRef = useRef<HTMLInputElement>(null);

  const handleSyllabusSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSyllabusFile(file);
      // Start processing syllabus in background
      await createSubjectFromSyllabus(file);
      // Immediately transition to papers stage (processing happens in background)
      setUploadStage('papers');
    }
  };

  const handleExamPapersSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setExamPapers(prev => [...prev, ...files]);
  };

  const removeExamPaper = (index: number) => {
    setExamPapers(prev => prev.filter((_, i) => i !== index));
  };

  const handleFinishUpload = async () => {
    if (subjects.length > 0 && examPapers.length > 0) {
      const latestSubject = subjects[subjects.length - 1];
      await processExamPapers(latestSubject.id, examPapers);
    }
    // Reset and close
    setSyllabusFile(null);
    setExamPapers([]);
    setUploadStage('initial');
  };

  const handleSkipPapers = () => {
    setSyllabusFile(null);
    setExamPapers([]);
    setUploadStage('initial');
  };

  const handleNavigate = (subjectId: string) => {
    setLoading(`navigate-${subjectId}`, true);
    setNavigatingTo(subjectId);
    // No need for router push here, Link component will handle it.
    // The loading state will be shown until the new page takes over.
  };

  if (navigatingTo && isLoading(`navigate-${navigatingTo}`)) {
    return <PageSpinner />;
  }

  const isCreatingSubject = isLoading('create-subject');

  return (
    <div className="container mx-auto">
      {subjects.length > 0 && (
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold font-headline">Your Subjects</h1>
          <Button onClick={() => setUploadStage('syllabus')} disabled={isCreatingSubject || uploadStage !== 'initial'}>
            {isCreatingSubject ? <LoadingSpinner /> : <Upload />}
            Create New Subject
          </Button>
        </div>
      )}
      <Input
        type="file"
        accept=".pdf,.txt,.md"
        ref={syllabusInputRef}
        className="hidden"
        onChange={handleSyllabusSelect}
      />
      <Input
        type="file"
        accept=".pdf,.txt,.md"
        ref={examPapersInputRef}
        className="hidden"
        onChange={handleExamPapersSelect}
        multiple
      />

      {/* Upload Dialog */}
      <AlertDialog open={uploadStage === 'syllabus' || uploadStage === 'papers'} onOpenChange={(open) => !open && handleSkipPapers()}>
        <AlertDialogContent className="max-w-2xl">
          {uploadStage === 'syllabus' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Upload Your Syllabus</AlertDialogTitle>
                <AlertDialogDescription>
                  Upload your exam syllabus to begin. We'll analyze it to identify paper types and topics.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="space-y-4">
                <div>
                  <Button
                    variant="outline"
                    onClick={() => syllabusInputRef.current?.click()}
                    type="button"
                    className="w-full"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {syllabusFile ? syllabusFile.name : 'Choose Syllabus File'}
                  </Button>
                </div>
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel onClick={handleSkipPapers}>
                  Cancel
                </AlertDialogCancel>
              </AlertDialogFooter>
            </>
          )}

          {uploadStage === 'papers' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Upload Past Exam Papers</AlertDialogTitle>
                <AlertDialogDescription>
                  Your syllabus is being processed in the background. Upload past exam papers to extract real exam questions.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Recommended:</strong> Upload at least 1 paper for each paper type.
                  </p>
                </div>

                <div>
                  <Button
                    variant="outline"
                    onClick={() => examPapersInputRef.current?.click()}
                    type="button"
                    className="w-full"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Add Exam Papers
                  </Button>

                  {examPapers.length > 0 && (
                    <div className="mt-3 max-h-64 overflow-y-auto border rounded-md p-2 space-y-2">
                      {examPapers.map((paper, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-sm truncate flex-1 mr-2">{paper.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeExamPaper(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel onClick={handleSkipPapers}>
                  Skip for Now
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleFinishUpload}
                  disabled={examPapers.length === 0 || isLoading(`process-papers-${subjects[subjects.length - 1]?.id}`)}
                >
                  {isLoading(`process-papers-${subjects[subjects.length - 1]?.id}`) ? <LoadingSpinner /> : 'Finish'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {subjects.length === 0 ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="text-center py-12 px-8 max-w-md">
            <CardContent className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold font-headline">Welcome to Erudate!</h2>
                <p className="text-muted-foreground mt-2">Start your exam preparation journey</p>
              </div>
              <Button
                size="lg"
                className="w-full text-lg py-6"
                onClick={() => setUploadStage('syllabus')}
                disabled={isCreatingSubject}
              >
                {isCreatingSubject ? <LoadingSpinner /> : 'Get Started!'}
              </Button>
              <p className="text-sm text-muted-foreground">
                Upload a syllabus to create your first subject
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map((subject) => (
            <Card key={subject.id} className="flex flex-col hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline">
                  <BookOpen className="text-primary" />
                  {subject.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground">
                  {subject.paperTypes.length} paper types identified.
                </p>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button asChild variant="default" size="sm" onClick={() => handleNavigate(subject.id)}>
                  <Link href={`/subject/${subject.id}`}>Manage</Link>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon">
                      <Trash2 />
                      <span className="sr-only">Delete Subject</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the "{subject.name}" subject and all its data. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteSubject(subject.id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
