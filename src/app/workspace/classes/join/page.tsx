"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, CheckCircle, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ClassMembership {
  id: number;
  class_id: number;
  user_role: string;
  membership_status: string;
  name: string;
  description: string | null;
  classroom_code: string;
  created_at: number;
}

export default function JoinClassPage() {
  const [classroomCode, setClassroomCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [classes, setClasses] = useState<ClassMembership[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const response = await fetch('/api/classes?role=student');
      if (response.ok) {
        const data = await response.json();
        setClasses(data);
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!classroomCode.trim()) {
      toast.error('Please enter a classroom code');
      return;
    }

    setJoining(true);
    try {
      const response = await fetch('/api/classes/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classroomCode: classroomCode.toUpperCase().trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || 'Join request submitted successfully');
        setClassroomCode('');
        fetchClasses();
      } else {
        toast.error(data.error || 'Failed to join class');
      }
    } catch (error) {
      console.error('Error joining class:', error);
      toast.error('Failed to join class');
    } finally {
      setJoining(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Approved</span>
          </div>
        );
      case 'pending':
        return (
          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">Pending</span>
          </div>
        );
      case 'rejected':
        return (
          <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <XCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Rejected</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Join a Class</h1>
        <p className="text-muted-foreground">
          Enter your teacher's classroom code to join their class
        </p>
      </div>

      {/* Join Form */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Enter Classroom Code</CardTitle>
          <CardDescription>
            Your teacher will provide you with a 6-character classroom code
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJoinClass} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="classroomCode">Classroom Code</Label>
              <div className="flex gap-2">
                <Input
                  id="classroomCode"
                  placeholder="ABC123"
                  value={classroomCode}
                  onChange={(e) => setClassroomCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="uppercase font-mono text-lg"
                  disabled={joining}
                />
                <Button type="submit" disabled={joining}>
                  {joining ? 'Joining...' : 'Join Class'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The code is not case-sensitive and should be 6 characters long
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* My Classes */}
      <div>
        <h2 className="text-2xl font-bold mb-4">My Classes</h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : classes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No classes yet</h3>
              <p className="text-muted-foreground text-center">
                Use your teacher's classroom code to join your first class
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {classes.map((cls) => (
              <Card key={cls.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{cls.name}</h3>
                        {getStatusBadge(cls.membership_status)}
                      </div>
                      {cls.description && (
                        <p className="text-sm text-muted-foreground mb-2">{cls.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Code: <code className="font-mono font-bold">{cls.classroom_code}</code></span>
                        <span>Joined {new Date(cls.created_at * 1000).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
