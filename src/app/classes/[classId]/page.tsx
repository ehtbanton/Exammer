"use client";

import { useEffect, useState } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, BookOpen, BarChart3, Check, X, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface ClassData {
  id: number;
  name: string;
  description: string | null;
  classroom_code: string;
  member_count: number;
  pending_count: number;
  subject_count: number;
}

interface Member {
  id: number;
  user_id: number;
  user_name: string | null;
  user_email: string;
  role: string;
  status: string;
  joined_at: number;
}

interface Subject {
  id: number;
  name: string;
  added_at: number;
  added_by_name: string | null;
}

interface AvailableSubject {
  id: number;
  name: string;
}

export default function ClassDashboardPage({ params }: { params: Promise<{ classId: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const classId = parseInt(resolvedParams.classId);

  const [classData, setClassData] = useState<ClassData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<AvailableSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('roster');
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [subjectToRemove, setSubjectToRemove] = useState<Subject | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [addingSubject, setAddingSubject] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchClassData();
    fetchMembers();
    fetchSubjects();
    fetchAvailableSubjects();
  }, [classId]);

  const fetchClassData = async () => {
    try {
      const response = await fetch(`/api/classes/${classId}`);
      if (response.ok) {
        const data = await response.json();
        setClassData(data);
      } else if (response.status === 403) {
        toast.error('You do not have access to this class');
        router.push('/classes');
      }
    } catch (error) {
      console.error('Error fetching class data:', error);
      toast.error('Failed to load class data');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await fetch(`/api/classes/${classId}/members`);
      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  const fetchSubjects = async () => {
    try {
      const response = await fetch(`/api/classes/${classId}/subjects`);
      if (response.ok) {
        const data = await response.json();
        setSubjects(data);
      }
    } catch (error) {
      console.error('Error fetching subjects:', error);
    }
  };

  const fetchAvailableSubjects = async () => {
    try {
      const response = await fetch('/api/subjects');
      if (response.ok) {
        const data = await response.json();
        setAvailableSubjects(data.map((s: any) => ({ id: s.id, name: s.name })));
      }
    } catch (error) {
      console.error('Error fetching available subjects:', error);
    }
  };

  const handleApproveReject = async (userId: number, action: 'approve' | 'reject') => {
    try {
      const response = await fetch(`/api/classes/${classId}/members/${userId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        toast.success(`Request ${action}d successfully`);
        fetchMembers();
        fetchClassData();
      } else {
        const error = await response.json();
        toast.error(error.error || `Failed to ${action} request`);
      }
    } catch (error) {
      console.error(`Error ${action}ing member:`, error);
      toast.error(`Failed to ${action} request`);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    try {
      const response = await fetch(`/api/classes/${classId}/members/${memberToRemove.user_id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Member removed successfully');
        fetchMembers();
        fetchClassData();
        setMemberToRemove(null);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to remove member');
      }
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    }
  };

  const handleAddSubject = async () => {
    if (!selectedSubject) {
      toast.error('Please select a subject');
      return;
    }

    setAddingSubject(true);
    try {
      const response = await fetch(`/api/classes/${classId}/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId: parseInt(selectedSubject) }),
      });

      if (response.ok) {
        toast.success('Subject added to class');
        fetchSubjects();
        fetchClassData();
        setSelectedSubject('');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to add subject');
      }
    } catch (error) {
      console.error('Error adding subject:', error);
      toast.error('Failed to add subject');
    } finally {
      setAddingSubject(false);
    }
  };

  const handleRemoveSubject = async () => {
    if (!subjectToRemove) return;

    try {
      const response = await fetch(`/api/classes/${classId}/subjects/${subjectToRemove.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Subject removed from class');
        fetchSubjects();
        fetchClassData();
        setSubjectToRemove(null);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to remove subject');
      }
    } catch (error) {
      console.error('Error removing subject:', error);
      toast.error('Failed to remove subject');
    }
  };

  const handleDeleteClass = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/classes/${classId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Class deleted successfully');
        router.push('/classes');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete class');
      }
    } catch (error) {
      console.error('Error deleting class:', error);
      toast.error('Failed to delete class');
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
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

  if (!classData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Class not found</h1>
          <Button className="mt-4" onClick={() => router.push('/classes')}>
            Back to Classes
          </Button>
        </div>
      </div>
    );
  }

  const pendingMembers = members.filter(m => m.status === 'pending');
  const approvedMembers = members.filter(m => m.status === 'approved');

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push('/classes')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Classes
        </Button>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{classData.name}</h1>
            {classData.description && (
              <p className="text-muted-foreground">{classData.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span>Code: <code className="font-mono font-bold">{classData.classroom_code}</code></span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => router.push(`/classes/${classId}/analytics`)}>
              <BarChart3 className="h-4 w-4 mr-2" />
              View Analytics
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Class
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="roster">
            <Users className="h-4 w-4 mr-2" />
            Roster
            {pendingMembers.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingMembers.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="subjects">
            <BookOpen className="h-4 w-4 mr-2" />
            Subjects
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roster" className="space-y-4">
          {pendingMembers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pending Requests</CardTitle>
                <CardDescription>Review and approve student join requests</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>{member.user_name || 'Unnamed User'}</TableCell>
                        <TableCell>{member.user_email}</TableCell>
                        <TableCell>
                          {new Date(member.joined_at * 1000).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApproveReject(member.user_id, 'approve')}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApproveReject(member.user_id, 'reject')}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Class Members ({approvedMembers.length})</CardTitle>
              <CardDescription>Students and teachers in this class</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>{member.user_name || 'Unnamed User'}</TableCell>
                      <TableCell>{member.user_email}</TableCell>
                      <TableCell>
                        <Badge variant={member.role === 'teacher' ? 'default' : 'secondary'}>
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(member.joined_at * 1000).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {member.role === 'student' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setMemberToRemove(member)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subjects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Subject to Class</CardTitle>
              <CardDescription>Assign subjects for students to access</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a subject..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubjects
                      .filter(s => !subjects.find(cs => cs.id === s.id))
                      .map((subject) => (
                        <SelectItem key={subject.id} value={subject.id.toString()}>
                          {subject.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddSubject} disabled={addingSubject || !selectedSubject}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Subject
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Class Subjects ({subjects.length})</CardTitle>
              <CardDescription>Subjects assigned to this class</CardDescription>
            </CardHeader>
            <CardContent>
              {subjects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No subjects assigned yet. Add subjects above.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject Name</TableHead>
                      <TableHead>Added By</TableHead>
                      <TableHead>Added On</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subjects.map((subject) => (
                      <TableRow key={subject.id}>
                        <TableCell className="font-medium">{subject.name}</TableCell>
                        <TableCell>{subject.added_by_name || 'Unknown'}</TableCell>
                        <TableCell>
                          {new Date(subject.added_at * 1000).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSubjectToRemove(subject)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Remove Member Dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {memberToRemove?.user_name || memberToRemove?.user_email} from this class?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Subject Dialog */}
      <AlertDialog open={!!subjectToRemove} onOpenChange={() => setSubjectToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Subject</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {subjectToRemove?.name} from this class?
              Students will no longer have access to this subject through this class.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveSubject}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Class Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Class</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{classData?.name}"? This action cannot be undone.
              All members will be removed and students will lose access to class subjects.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClass}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete Class'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
