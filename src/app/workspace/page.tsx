"use client";

import { ChangeEvent, useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/app/context/AppContext';
import { AuthGuard } from '@/components/AuthGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Upload, Trash2, BookOpen, UserPlus, UserMinus, Crown } from 'lucide-react';
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
  const router = useRouter();
  const { subjects, otherSubjects, isLevel3User, createSubjectFromSyllabus, deleteSubject, addSubjectToWorkspace, removeSubjectFromWorkspace, searchSubjects, isLoading, setLoading } = useAppContext();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const [uploadStage, setUploadStage] = useState<'initial' | 'syllabus'>('initial');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [accessLevel, setAccessLevel] = useState<number | null>(null);
  const syllabusInputRef = useRef<HTMLInputElement>(null);

  // Fetch user's access level
  useEffect(() => {
    const fetchAccessLevel = async () => {
      try {
        const response = await fetch('/api/auth/access-level');
        if (response.ok) {
          const data = await response.json();
          setAccessLevel(data.accessLevel);
        }
      } catch (error) {
        console.error('Error fetching access level:', error);
      }
    };

    fetchAccessLevel();
  }, []);

  const handleSyllabusSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSyllabusFile(file);
      // Start processing syllabus in background
      const subjectId = await createSubjectFromSyllabus(file);
      // Close the dialog and redirect to the new subject page with auto-open parameter
      setUploadStage('initial');
      setSyllabusFile(null);
      if (subjectId) {
        router.push(`/workspace/subject/${subjectId}`);
      }
    }
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
        {/* Only show Create button for level 2+ users (teachers and admins) */}
        {(accessLevel === null || accessLevel >= 2) && (
          <Button onClick={() => setUploadStage('syllabus')} disabled={isCreatingSubject || uploadStage !== 'initial'}>
            {isCreatingSubject ? <LoadingSpinner /> : <Upload />}
            Create New Subject
          </Button>
        )}
      </div>
      <Input
        type="file"
        accept=".pdf,.txt,.md"
        ref={syllabusInputRef}
        className="hidden"
        onChange={handleSyllabusSelect}
      />

      {/* Upload Dialog */}
      <AlertDialog open={uploadStage === 'syllabus'} onOpenChange={(open) => !open && setUploadStage('initial')}>
        <AlertDialogContent className="max-w-2xl">
          {uploadStage === 'syllabus' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Upload Your Syllabus</AlertDialogTitle>
                <AlertDialogDescription>
                  Upload your exam syllabus to begin. We'll analyze it to identify paper types and topics, then you can upload past papers.
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
                <AlertDialogCancel onClick={() => setUploadStage('initial')}>
                  Cancel
                </AlertDialogCancel>
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
                    <Link href={`/workspace/subject/${subject.id}`}>Study</Link>
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
                    {/* Only allow level 2+ users to remove subjects from workspace */}
                    {(accessLevel === null || accessLevel >= 2) && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => removeSubjectFromWorkspace(subject.id)}
                        disabled={isLoading(`remove-workspace-${subject.id}`)}
                      >
                        {isLoading(`remove-workspace-${subject.id}`) ? <LoadingSpinner /> : <UserMinus />}
                        <span className="sr-only">Remove from Workspace</span>
                      </Button>
                    )}
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

      {/* Search Subjects Section - Only for level 2+ users (teachers and admins) */}
      {(accessLevel === null || accessLevel >= 2) && (
        <>
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
        </>
      )}
    </div>
  );
}
