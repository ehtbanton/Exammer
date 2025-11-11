"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Users, BookOpen, Clock, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Class {
  id: number;
  name: string;
  description: string | null;
  classroom_code: string;
  created_at: number;
  member_count: number;
  pending_count: number;
  subject_count: number;
  user_role: string;
}

export default function ClassesPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDescription, setNewClassDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchClasses();

    // Refetch classes when the page becomes visible (e.g., returning from class detail page)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchClasses();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const fetchClasses = async () => {
    try {
      const response = await fetch('/api/classes?role=teacher');
      if (response.ok) {
        const data = await response.json();
        setClasses(data);
      } else {
        toast.error('Failed to fetch classes');
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
      toast.error('Failed to fetch classes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClass = async () => {
    if (!newClassName.trim()) {
      toast.error('Class name is required');
      return;
    }

    console.log('[handleCreateClass] Starting class creation:', { name: newClassName, description: newClassDescription });
    setCreating(true);
    try {
      const response = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClassName,
          description: newClassDescription || null,
        }),
      });

      console.log('[handleCreateClass] Response status:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('[handleCreateClass] Class created successfully:', data);
        toast.success('Class created successfully');
        setCreateDialogOpen(false);
        setNewClassName('');
        setNewClassDescription('');
        fetchClasses();
      } else {
        const error = await response.json();
        console.error('[handleCreateClass] Error response:', error);
        toast.error(error.error || 'Failed to create class');
      }
    } catch (error) {
      console.error('[handleCreateClass] Exception caught:', error);
      toast.error('Failed to create class');
    } finally {
      console.log('[handleCreateClass] Finished, setting creating to false');
      setCreating(false);
    }
  };

  const copyClassroomCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Classroom code copied to clipboard');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">My Classes</h1>
          <p className="text-muted-foreground mt-2">
            Manage your classes and track student progress
          </p>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Class
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Class</DialogTitle>
              <DialogDescription>
                Create a new class and get a unique classroom code to share with students.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="className">Class Name *</Label>
                <Input
                  id="className"
                  placeholder="e.g., AP Chemistry 2025"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="classDescription">Description (Optional)</Label>
                <Textarea
                  id="classDescription"
                  placeholder="Add a description for your class..."
                  value={newClassDescription}
                  onChange={(e) => setNewClassDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateClass} disabled={creating}>
                {creating ? 'Creating...' : 'Create Class'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {classes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No classes yet</h3>
            <p className="text-muted-foreground text-center mb-6">
              Create your first class to start managing students and assignments
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Class
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((cls) => (
            <Card
              key={cls.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(`/workspace/classes/${cls.id}`)}
            >
              <CardHeader>
                <CardTitle>{cls.name}</CardTitle>
                <CardDescription>{cls.description || 'No description'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Classroom Code:</span>
                    <div className="flex items-center gap-2">
                      <code className="bg-muted px-2 py-1 rounded font-mono font-bold">
                        {cls.classroom_code}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyClassroomCode(cls.classroom_code);
                        }}
                      >
                        {copiedCode === cls.classroom_code ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{cls.member_count} members</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      <span>{cls.subject_count} subjects</span>
                    </div>
                  </div>

                  {cls.pending_count > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded px-3 py-2">
                      <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
                        <Clock className="h-4 w-4" />
                        <span>{cls.pending_count} pending request{cls.pending_count !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">
                    Created {new Date(cls.created_at * 1000).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
