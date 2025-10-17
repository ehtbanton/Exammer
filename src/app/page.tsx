"use client";

import { ChangeEvent, useRef, useState } from 'react';
import Link from 'next/link';
import { useAppContext } from '@/app/context/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Upload, Trash2, BookOpen } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import PageSpinner from '@/components/PageSpinner';

export default function HomePage() {
  const { subjects, createSubjectFromSyllabus, deleteSubject, isLoading, setLoading } = useAppContext();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const syllabusInputRef = useRef<HTMLInputElement>(null);

  const handleSyllabusUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      createSubjectFromSyllabus(file);
    }
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
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold font-headline">Your Subjects</h1>
        <Button onClick={() => syllabusInputRef.current?.click()} disabled={isCreatingSubject}>
          {isCreatingSubject ? <LoadingSpinner /> : <Upload />}
          Upload Syllabus
        </Button>
        <Input
          type="file"
          accept=".pdf,.txt,.md"
          ref={syllabusInputRef}
          className="hidden"
          onChange={handleSyllabusUpload}
        />
      </div>

      {subjects.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <h2 className="text-xl font-semibold">No subjects yet!</h2>
            <p className="text-muted-foreground mt-2">Upload a syllabus to get started.</p>
          </CardContent>
        </Card>
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
