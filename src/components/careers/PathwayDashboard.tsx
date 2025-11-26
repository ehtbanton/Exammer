"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Calendar,
  Target,
  BookOpen,
  Award,
  Clock,
  CheckCircle2,
  Circle,
  Sparkles,
  TrendingUp,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import ReplanDialog from './ReplanDialog';
import MilestoneDetailDialog from './MilestoneDetailDialog';

interface Milestone {
  id: number;
  month: string;
  title: string;
  description: string;
  category: 'academic' | 'extracurricular' | 'application' | 'skill-building';
  priority: 'essential' | 'important' | 'optional';
  status: 'pending' | 'in_progress' | 'completed';
  completed_at: number | null;
  completion_notes?: string;
}

interface SubjectTarget {
  id: number;
  subject_name: string;
  current_level: string | null;
  target_grade: string;
  key_focus_areas: string;
}

interface Pathway {
  id: number;
  title: string;
  overview_summary: string;
  application_timeline: string;
  created_at: number;
  milestones: Milestone[];
  subjectTargets: SubjectTarget[];
}

interface PathwayDashboardProps {
  sessionId: number;
  universityName: string;
  courseName: string;
}

export default function PathwayDashboard({
  sessionId,
  universityName,
  courseName,
}: PathwayDashboardProps) {
  const [pathway, setPathway] = useState<Pathway | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showReplanDialog, setShowReplanDialog] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadPathway();
  }, [sessionId]);

  const loadPathway = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/careers/pathways?sessionId=${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setPathway(data.pathway);
      }
    } catch (error) {
      console.error('Error loading pathway:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePathway = async (reason?: string, reasonType?: string) => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/careers/pathways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          replanReason: reason,
          replanReasonType: reasonType,
        }),
      });

      if (response.ok) {
        toast({
          title: reason ? 'Pathway replanned!' : 'Pathway generated!',
          description: reason ? 'Your pathway has been updated' : 'Your personalized pathway is ready',
        });
        await loadPathway();
      } else {
        throw new Error('Failed to generate pathway');
      }
    } catch (error) {
      console.error('Error generating pathway:', error);
      toast({
        title: 'Failed to generate pathway',
        description: 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReplan = async (reason: string, reasonType: string) => {
    await handleGeneratePathway(reason, reasonType);
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to start over? This will delete your current progress.')) return;
    
    try {
      await fetch('/api/careers/sessions/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      window.location.reload();
    } catch (error) {
      console.error('Error resetting:', error);
      toast({
        title: 'Failed to reset',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateMilestone = async (milestoneId: number, status: string, notes: string) => {
    try {
      const response = await fetch('/api/careers/pathways/milestones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestoneId,
          status,
          completionNotes: notes,
        }),
      });

      if (response.ok) {
        await loadPathway();
        toast({
          title: 'Milestone updated',
          description: status === 'completed' ? 'Great progress!' : 'Status updated',
        });
      } else {
        throw new Error('Failed to update milestone');
      }
    } catch (error) {
      console.error('Error updating milestone:', error);
      toast({
        title: 'Failed to update milestone',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Show generate button if no pathway exists
  if (!pathway) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl relative">
        <div className="absolute top-0 right-4">
          <Button variant="ghost" onClick={handleReset} className="text-muted-foreground hover:text-destructive flex gap-2">
            <RotateCcw className="w-4 h-4" />
            Start Over
          </Button>
        </div>
        <Card className="text-center p-12 mt-8">
          <Sparkles className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h2 className="text-2xl font-bold mb-4">Ready to Generate Your Pathway</h2>
          <p className="text-muted-foreground mb-2">
            We'll create a personalized month-by-month plan to help you achieve your goal:
          </p>
          <div className="bg-muted/50 p-4 rounded-lg mb-6 inline-block">
            <p className="font-semibold">{universityName}</p>
            <p className="text-muted-foreground">{courseName}</p>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Your pathway will include grade targets, exam prep schedules, extracurricular recommendations,
            and links to Exammer topics you need to improve.
          </p>
          <Button
            size="lg"
            onClick={() => handleGeneratePathway()}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Your Pathway...
              </>
            ) : (
              <>
                Generate My Pathway
                <Sparkles className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </Card>
      </div>
    );
  }

  // Calculate completion stats
  const monthlyMilestones = pathway.milestones.filter(m => m.month !== 'Ongoing');
  const ongoingActivities = pathway.milestones.filter(m => m.month === 'Ongoing');
  const completedCount = pathway.milestones.filter(m => m.status === 'completed').length;
  const totalCount = pathway.milestones.length;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const categoryIcons = {
    academic: BookOpen,
    extracurricular: Award,
    application: Calendar,
    'skill-building': TrendingUp,
  };

  const priorityColors = {
    essential: 'destructive',
    important: 'default',
    optional: 'secondary',
  } as const;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">{pathway.title}</h1>
            <p className="text-muted-foreground">{pathway.overview_summary}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowReplanDialog(true)}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Replanning...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Replan
                </>
              )}
            </Button>
            <Button variant="ghost" onClick={handleReset} className="text-muted-foreground hover:text-destructive">
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              <span className="font-semibold">Overall Progress</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {completedCount} of {totalCount} milestones completed
            </span>
          </div>
          <Progress value={progressPercentage} className="h-3" />
          <p className="text-sm text-muted-foreground mt-2">
            {progressPercentage}% complete
          </p>
        </Card>
      </div>

      {/* Main content tabs */}
      <Tabs defaultValue="timeline" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="timeline">
            <Calendar className="w-4 h-4 mr-2" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="subjects">
            <BookOpen className="w-4 h-4 mr-2" />
            Subject Targets
          </TabsTrigger>
          <TabsTrigger value="activities">
            <Award className="w-4 h-4 mr-2" />
            Activities
          </TabsTrigger>
        </TabsList>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-6">
          <div className="space-y-4">
            {monthlyMilestones.map((milestone, index) => {
              const Icon = categoryIcons[milestone.category];
              return (
                <Card
                  key={milestone.id}
                  className={`cursor-pointer transition-all hover:shadow-md 
                    ${milestone.status === 'completed' ? 'opacity-60 bg-muted/50' : ''}
                    ${milestone.status === 'in_progress' ? 'border-blue-500 border-2' : ''}
                  `}
                  onClick={() => setSelectedMilestone(milestone)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateMilestone(
                              milestone.id,
                              milestone.status === 'completed' ? 'pending' : 'completed',
                              milestone.completion_notes || ''
                            );
                          }}
                          className="mt-1 hover:scale-110 transition-transform"
                        >
                          {milestone.status === 'completed' ? (
                            <CheckCircle2 className="w-6 h-6 text-green-600" />
                          ) : milestone.status === 'in_progress' ? (
                            <Clock className="w-6 h-6 text-blue-500" />
                          ) : (
                            <Circle className="w-6 h-6 text-muted-foreground" />
                          )}
                        </button>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              <Clock className="w-3 h-3 mr-1" />
                              {milestone.month}
                            </Badge>
                            <Badge variant={priorityColors[milestone.priority]}>
                              {milestone.priority}
                            </Badge>
                          </div>
                          <CardTitle className={`text-lg ${milestone.status === 'completed' ? 'line-through' : ''}`}>
                            {milestone.title}
                          </CardTitle>
                          <CardDescription className="mt-2">
                            {milestone.description}
                          </CardDescription>
                          {milestone.completion_notes && (
                            <div className="mt-3 text-sm bg-muted/50 p-2 rounded-md border-l-2 border-primary">
                              <strong>Note:</strong> {milestone.completion_notes}
                            </div>
                          )}
                        </div>
                        <Icon className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Subject Targets Tab */}
        <TabsContent value="subjects" className="space-y-4">
          {pathway.subjectTargets.map((target) => {
            const focusAreas = JSON.parse(target.key_focus_areas);
            return (
              <Card key={target.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{target.subject_name}</CardTitle>
                    <div className="flex items-center gap-2">
                      {target.current_level && (
                        <Badge variant="outline">Current: {target.current_level}</Badge>
                      )}
                      <Badge variant="default" className="text-lg px-3">
                        Target: {target.target_grade}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-semibold mb-2">Key Focus Areas:</p>
                  <ul className="space-y-1">
                    {focusAreas.map((area: string, index: number) => (
                      <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{area}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Activities Tab */}
        <TabsContent value="activities" className="space-y-4">
          {ongoingActivities.length > 0 ? (
            ongoingActivities.map((activity) => (
              <Card 
                key={activity.id}
                className={`cursor-pointer transition-all hover:shadow-md ${activity.status === 'completed' ? 'opacity-60' : ''}`}
                onClick={() => setSelectedMilestone(activity)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateMilestone(
                            activity.id,
                            activity.status === 'completed' ? 'pending' : 'completed',
                            activity.completion_notes || ''
                          );
                        }}
                        className="mt-1 hover:scale-110 transition-transform"
                      >
                        {activity.status === 'completed' ? (
                          <CheckCircle2 className="w-6 h-6 text-green-600" />
                        ) : (
                          <Circle className="w-6 h-6 text-muted-foreground" />
                        )}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={priorityColors[activity.priority]}>
                            {activity.priority}
                          </Badge>
                        </div>
                        <CardTitle className={`text-lg ${activity.status === 'completed' ? 'line-through' : ''}`}>
                          {activity.title}
                        </CardTitle>
                        <CardDescription className="mt-2">
                          {activity.description}
                        </CardDescription>
                        {activity.completion_notes && (
                          <div className="mt-3 text-sm bg-muted/50 p-2 rounded-md border-l-2 border-primary">
                            <strong>Note:</strong> {activity.completion_notes}
                          </div>
                        )}
                      </div>
                      <Award className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          ) : (
            <Card className="p-12 text-center">
              <Award className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                No extracurricular activities recommended yet
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ReplanDialog
        open={showReplanDialog}
        onOpenChange={setShowReplanDialog}
        onReplan={handleReplan}
      />
      
      <MilestoneDetailDialog
        open={!!selectedMilestone}
        onOpenChange={(open) => !open && setSelectedMilestone(null)}
        milestone={selectedMilestone}
        onUpdate={handleUpdateMilestone}
      />
    </div>
  );
}