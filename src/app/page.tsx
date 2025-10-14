"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useAppContext } from '@/app/context/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { PlusCircle, Trash2, BookOpen } from 'lucide-react';

export default function HomePage() {
  const { exams, addExam, deleteExam } = useAppContext();
  const [newExamName, setNewExamName] = useState('');
  const [isDialogOpen, setDialogOpen] = useState(false);

  const handleAddExam = () => {
    if (newExamName.trim()) {
      addExam(newExamName.trim());
      setNewExamName('');
      setDialogOpen(false);
    }
  };

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold font-headline">Your Exams</h1>
        <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle />
              Create New Exam
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a New Exam</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Input
                placeholder="E.g., Final Year Chemistry"
                value={newExamName}
                onChange={(e) => setNewExamName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddExam()}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleAddExam}>Create Exam</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {exams.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <h2 className="text-xl font-semibold">No exams yet!</h2>
            <p className="text-muted-foreground mt-2">Click "Create New Exam" to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.map((exam) => (
            <Card key={exam.id} className="flex flex-col hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline">
                  <BookOpen className="text-primary" />
                  {exam.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground">
                  {exam.topics.length} topics identified.
                </p>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button asChild variant="default" size="sm">
                  <Link href={`/exam/${exam.id}`}>Study</Link>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon">
                      <Trash2 />
                      <span className="sr-only">Delete Exam</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the "{exam.name}" exam and all its data. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteExam(exam.id)}>Delete</AlertDialogAction>
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
