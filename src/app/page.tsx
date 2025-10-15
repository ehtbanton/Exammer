"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useAppContext } from '@/app/context/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { PlusCircle, Trash2, BookOpen } from 'lucide-react';
import PageSpinner from '@/components/PageSpinner';

export default function HomePage() {
  const { subjects, addSubject, deleteSubject, isLoading, setLoading } = useAppContext();
  const [newSubjectName, setNewSubjectName] = useState('');
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  const handleAddSubject = () => {
    if (newSubjectName.trim()) {
      addSubject(newSubjectName.trim());
      setNewSubjectName('');
      setDialogOpen(false);
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

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold font-headline">Your Subjects</h1>
        <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle />
              Create New Subject
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a New Subject</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Input
                placeholder="E.g., A-Level Chemistry"
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSubject()}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleAddSubject}>Create Subject</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {subjects.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <h2 className="text-xl font-semibold">No subjects yet!</h2>
            <p className="text-muted-foreground mt-2">Click "Create New Subject" to get started.</p>
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
