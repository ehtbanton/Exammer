"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Target, Sparkles, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UniversitySuggestion {
  universityName: string;
  courseName: string;
  reasoning: string;
  typicalOffer: string;
  keySubjects: string[];
}

interface GoalSettingProps {
  sessionId: number;
  sessionType: 'explore' | 'direct';
  brainstormData?: {
    interests: string[];
  };
  onComplete: () => void;
}

export default function GoalSetting({
  sessionId,
  sessionType,
  brainstormData,
  onComplete,
}: GoalSettingProps) {
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<UniversitySuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<UniversitySuggestion | null>(null);
  const [customUniversity, setCustomUniversity] = useState('');
  const [customCourse, setCustomCourse] = useState('');
  const [customOffer, setCustomOffer] = useState('');
  const [customSubjects, setCustomSubjects] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Load suggestions on mount for explore sessions
  useEffect(() => {
    if (sessionType === 'explore' && brainstormData?.interests) {
      loadSuggestions();
    }
  }, []);

  const loadSuggestions = async () => {
    setIsLoadingSuggestions(true);
    try {
      const response = await fetch('/api/careers/goals/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          brainstormInterests: brainstormData?.interests,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions);
      } else {
        throw new Error('Failed to load suggestions');
      }
    } catch (error) {
      console.error('Error loading suggestions:', error);
      toast({
        title: 'Failed to load suggestions',
        description: 'Please try entering your goal manually',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleSaveGoal = async () => {
    const goalData = isCustom
      ? {
          university: customUniversity,
          course: customCourse,
          typicalOffer: customOffer,
          requiredSubjects: customSubjects.split(',').map(s => s.trim()).filter(s => s),
        }
      : selectedSuggestion
      ? {
          university: selectedSuggestion.universityName,
          course: selectedSuggestion.courseName,
          typicalOffer: selectedSuggestion.typicalOffer,
          requiredSubjects: selectedSuggestion.keySubjects,
        }
      : null;

    if (!goalData?.university || !goalData?.course) {
      toast({
        title: 'Missing information',
        description: 'Please select a goal or enter university and course',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/careers/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          ...goalData,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Goal set!',
          description: 'Your university goal has been saved',
        });
        onComplete();
      } else {
        throw new Error('Failed to save goal');
      }
    } catch (error) {
      console.error('Error saving goal:', error);
      toast({
        title: 'Failed to save goal',
        description: 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingSuggestions) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="p-12 text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
          <h2 className="text-xl font-semibold mb-2">Analyzing your interests...</h2>
          <p className="text-muted-foreground">
            We're finding the best universities and courses for you
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Set Your University Goal</h1>
        <p className="text-muted-foreground">
          {sessionType === 'explore'
            ? 'Based on your brainstorming, here are some university courses that match your interests'
            : 'Enter the university and course you want to aim for'}
        </p>
      </div>

      {/* AI Suggestions (for explore sessions) */}
      {sessionType === 'explore' && suggestions.length > 0 && !isCustom && (
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Recommended for You
            </h2>
            <Button variant="outline" size="sm" onClick={() => setIsCustom(true)}>
              Enter My Own Goal
            </Button>
          </div>

          <div className="grid gap-4">
            {suggestions.map((suggestion, index) => (
              <Card
                key={index}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedSuggestion === suggestion
                    ? 'border-primary border-2 bg-primary/5'
                    : ''
                }`}
                onClick={() => setSelectedSuggestion(suggestion)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-1">
                        {suggestion.universityName}
                      </CardTitle>
                      <CardDescription className="text-base font-medium text-foreground">
                        {suggestion.courseName}
                      </CardDescription>
                    </div>
                    {selectedSuggestion === suggestion && (
                      <CheckCircle2 className="w-6 h-6 text-primary shrink-0" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    {suggestion.reasoning}
                  </p>
                  <div className="flex gap-4 text-sm">
                    <div>
                      <span className="font-medium">Typical Offer:</span>{' '}
                      <span className="text-muted-foreground">{suggestion.typicalOffer}</span>
                    </div>
                    <div>
                      <span className="font-medium">Key Subjects:</span>{' '}
                      <span className="text-muted-foreground">
                        {suggestion.keySubjects.join(', ')}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Custom Goal Input */}
      {(isCustom || sessionType === 'direct') && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Enter Your Goal
            </CardTitle>
            {isCustom && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCustom(false)}
                className="absolute top-4 right-4"
              >
                Back to Suggestions
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="university">University Name</Label>
              <Input
                id="university"
                placeholder="e.g., University of Edinburgh"
                value={customUniversity}
                onChange={(e) => setCustomUniversity(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="course">Course Name</Label>
              <Input
                id="course"
                placeholder="e.g., BSc Computer Science"
                value={customCourse}
                onChange={(e) => setCustomCourse(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="offer">Typical Entry Requirements (Optional)</Label>
              <Input
                id="offer"
                placeholder="e.g., AAB"
                value={customOffer}
                onChange={(e) => setCustomOffer(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subjects">Required Subjects (Optional)</Label>
              <Textarea
                id="subjects"
                placeholder="e.g., Mathematics, Physics (comma-separated)"
                value={customSubjects}
                onChange={(e) => setCustomSubjects(e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <Button
          size="lg"
          onClick={handleSaveGoal}
          disabled={isSaving || (!selectedSuggestion && !customUniversity)}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              Set This Goal
              <Target className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
