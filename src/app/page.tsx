"use client";

import { ChangeEvent, useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useAppContext } from '@/app/context/AppContext';
import { AuthGuard } from '@/components/AuthGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Upload, Trash2, BookOpen, FileText, Plus, UserPlus, UserMinus, Crown } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import PageSpinner from '@/components/PageSpinner';
import WorkspaceLoading from '@/components/WorkspaceLoading';

export default function HomePage() {
  return (
    <AuthGuard>
      <HomePageContent />
    </AuthGuard>
  );
}

function HomePageContent() {
  const { subjects, otherSubjects, isLevel3User, createSubjectFromSyllabus, processExamPapers, deleteSubject, addSubjectToWorkspace, removeSubjectFromWorkspace, searchSubjects, isLoading, setLoading } = useAppContext();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const [uploadStage, setUploadStage] = useState<'initial' | 'syllabus' | 'papers' | 'markschemes'>('initial');
  const [examPapers, setExamPapers] = useState<File[]>([]);
  const [markschemes, setMarkschemes] = useState<File[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const syllabusInputRef = useRef<HTMLInputElement>(null);
  const examPapersInputRef = useRef<HTMLInputElement>(null);
  const markschemesInputRef = useRef<HTMLInputElement>(null);

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

  const handleMarkschemesSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setMarkschemes(prev => [...prev, ...files]);
  };

  const removeMarkscheme = (index: number) => {
    setMarkschemes(prev => prev.filter((_, i) => i !== index));
  };

  const handleContinueToMarkschemes = () => {
    setUploadStage('markschemes');
  };

  const handleFinishUpload = async () => {
    if (subjects.length > 0 && examPapers.length > 0) {
      const latestSubject = subjects[subjects.length - 1];
      await processExamPapers(latestSubject.id, examPapers, markschemes);
    }
    // Reset and close
    setSyllabusFile(null);
    setExamPapers([]);
    setMarkschemes([]);
    setUploadStage('initial');
  };

  const handleSkipPapers = () => {
    setSyllabusFile(null);
    setExamPapers([]);
    setMarkschemes([]);
    setUploadStage('initial');
  };

  const handleNavigate = (subjectId: string) => {
    setLoading(`navigate-${subjectId}`, true);
    setNavigatingTo(subjectId);
    // No need for router push here, Link component will handle it.
    // The loading state will be shown until the new page takes over.
  };

  // Auto-search with debouncing whenever searchQuery changes
  useEffect(() => {
    const delaySearch = setTimeout(async () => {
      if (searchQuery.trim()) {
        await searchSubjects(searchQuery);
        setHasSearched(true);
      } else {
        // Clear results if search query is empty
        setHasSearched(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(delaySearch);
  }, [searchQuery, searchSubjects]);

  if (navigatingTo && isLoading(`navigate-${navigatingTo}`)) {
    return <PageSpinner />;
  }

  const isCreatingSubject = isLoading('create-subject');

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold font-headline">My Workspace</h1>
        <Button onClick={() => setUploadStage('syllabus')} disabled={isCreatingSubject || uploadStage !== 'initial'}>
          {isCreatingSubject ? <LoadingSpinner /> : <Upload />}
          Create New Subject
        </Button>
      </div>
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
      <Input
        type="file"
        accept=".pdf,.txt,.md"
        ref={markschemesInputRef}
        className="hidden"
        onChange={handleMarkschemesSelect}
        multiple
      />

      {/* Upload Dialog */}
      <AlertDialog open={uploadStage === 'syllabus' || uploadStage === 'papers' || uploadStage === 'markschemes'} onOpenChange={(open) => !open && handleSkipPapers()}>
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
                  onClick={handleContinueToMarkschemes}
                  disabled={examPapers.length === 0}
                >
                  Continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}

          {uploadStage === 'markschemes' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Upload Markschemes</AlertDialogTitle>
                <AlertDialogDescription>
                  Upload the markschemes for your past papers. We'll use these to extract solution objectives and track your progress accurately.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Note:</strong> Upload all markschemes. We'll automatically match them to the corresponding papers.
                  </p>
                </div>

                <div>
                  <Button
                    variant="outline"
                    onClick={() => markschemesInputRef.current?.click()}
                    type="button"
                    className="w-full"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Add Markschemes
                  </Button>

                  {markschemes.length > 0 && (
                    <div className="mt-3 max-h-64 overflow-y-auto border rounded-md p-2 space-y-2">
                      {markschemes.map((markscheme, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-sm truncate flex-1 mr-2">{markscheme.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMarkscheme(index)}
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
                  disabled={markschemes.length === 0 || isLoading(`process-papers-${subjects[subjects.length - 1]?.id}`)}
                >
                  {isLoading(`process-papers-${subjects[subjects.length - 1]?.id}`) ? <LoadingSpinner /> : 'Finish'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* My Workspace Section */}
      {isLoading('fetch-subjects') ? (
        <WorkspaceLoading />
      ) : subjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {subjects.map((subject) => (
              <Card key={subject.id} className="flex flex-col hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-headline">
                    <BookOpen className="text-primary" />
                    {subject.name}
                    {subject.isCreator && (
                      <span title="Created by you">
                        <Crown className="h-4 w-4 text-yellow-500" />
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground">
                    {subject.paperTypes.length} paper types identified.
                  </p>
                </CardContent>
                <CardFooter className="flex justify-between gap-2">
                  <Button asChild variant="default" size="sm" onClick={() => handleNavigate(subject.id)}>
                    <Link href={`/subject/${subject.id}`}>Study</Link>
                  </Button>
                  <div className="flex gap-2">
                    {(subject.isCreator || isLevel3User) && (
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
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => removeSubjectFromWorkspace(subject.id)}
                      disabled={isLoading(`remove-workspace-${subject.id}`)}
                    >
                      {isLoading(`remove-workspace-${subject.id}`) ? <LoadingSpinner /> : <UserMinus />}
                      <span className="sr-only">Remove from Workspace</span>
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
      ) : (
        <div className="mb-12">
          <Card className="text-center py-8">
            <CardContent>
              <p className="text-muted-foreground">
                Your workspace is empty. Create a new subject or add one from below.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search Subjects Section */}
      <div className="mb-8 mt-12">
        <h2 className="text-2xl font-bold font-headline mb-4">Find More Subjects</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Search for subjects created by others and add them to your workspace
        </p>
        <div className="max-w-2xl">
          <Input
            type="text"
            placeholder="Search for subjects... (auto-search as you type)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
          {isLoading('search-subjects') && (
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <LoadingSpinner />
              <span>Searching...</span>
            </div>
          )}
        </div>
      </div>

      {/* Search Results */}
      {hasSearched && (
        <>
          {otherSubjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {otherSubjects.map((subject) => (
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
                  <CardFooter className="flex justify-between gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => addSubjectToWorkspace(subject.id)}
                      disabled={isLoading(`add-workspace-${subject.id}`)}
                      className="flex-1"
                    >
                      {isLoading(`add-workspace-${subject.id}`) ? <LoadingSpinner /> : <UserPlus className="mr-2 h-4 w-4" />}
                      Add to Workspace
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-8">
              <CardContent>
                <p className="text-muted-foreground">
                  No subjects found matching "{searchQuery}". Try a different search term.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
