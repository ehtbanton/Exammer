"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AcademicOnboardingProps {
  sessionId: number;
  onComplete: () => void;
}

interface Subject {
  name: string;
  level: string;
  grade: string;
}

export default function AcademicOnboarding({ sessionId, onComplete }: AcademicOnboardingProps) {
  const [subjects, setSubjects] = useState<Subject[]>([
    { name: '', level: '', grade: '' },
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSubjectChange = (index: number, field: keyof Subject, value: string) => {
    const newSubjects = [...subjects];
    newSubjects[index][field] = value;
    setSubjects(newSubjects);
  };

  const addSubject = () => {
    setSubjects([...subjects, { name: '', level: '', grade: '' }]);
  };

  const removeSubject = (index: number) => {
    const newSubjects = subjects.filter((_, i) => i !== index);
    setSubjects(newSubjects);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/careers/sessions/academic-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          subjects,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Profile updated!',
          description: 'Your academic profile has been saved.',
        });
        onComplete();
      } else {
        throw new Error('Failed to save academic profile');
      }
    } catch (error) {
      console.error('Error saving academic profile:', error);
      toast({
        title: 'Failed to save profile',
        description: 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Tell us about your academics</CardTitle>
          <CardDescription>
            This information will help us create a more accurate and personalized pathway for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-lg font-medium">Your Subjects</Label>
            <div className="space-y-4 mt-2">
              {subjects.map((subject, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={`subject-name-${index}`}>Subject Name</Label>
                    <Input
                      id={`subject-name-${index}`}
                      placeholder="e.g., Mathematics"
                      value={subject.name}
                      onChange={(e) => handleSubjectChange(index, 'name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`subject-level-${index}`}>Level</Label>
                    <Input
                      id={`subject-level-${index}`}
                      placeholder="e.g., A-Level"
                      value={subject.level}
                      onChange={(e) => handleSubjectChange(index, 'level', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`subject-grade-${index}`}>Current/Predicted Grade</Label>
                    <Input
                      id={`subject-grade-${index}`}
                      placeholder="e.g., A*"
                      value={subject.grade}
                      onChange={(e) => handleSubjectChange(index, 'grade', e.target.value)}
                    />
                  </div>
                  {subjects.length > 1 && (
                    <div className="md:col-span-4 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSubject(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={addSubject} className="mt-4">
              Add Another Subject
            </Button>
          </div>

          <div className="flex justify-end">
            <Button size="lg" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save and Continue'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
