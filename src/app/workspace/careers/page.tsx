"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { AuthGuard } from '@/components/AuthGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Target, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import BrainstormMindmap from '@/components/careers/BrainstormMindmap';
import GoalSetting from '@/components/careers/GoalSetting';
import PathwayDashboard from '@/components/careers/PathwayDashboard';
import AcademicOnboarding from '@/components/careers/AcademicOnboarding';
import { useToast } from '@/hooks/use-toast';

export default function CareersPage() {
  return (
    <AuthGuard>
      <CareersPageContent />
    </AuthGuard>
  );
}

interface CareerSession {
  id: number;
  session_type: 'explore' | 'direct';
  brainstorm_complete: number;
  academic_profile_complete: number;
  current_school: string | null;
  current_year_group: string | null;
  target_application_year: number | null;
}

interface CareerGoal {
  id: number;
  university_name: string;
  course_name: string;
  entry_requirements: string | null;
}

function CareersPageContent() {
  const { data: session } = useSession();
  const [currentSession, setCurrentSession] = useState<CareerSession | null>(null);
  const [currentGoal, setCurrentGoal] = useState<CareerGoal | null>(null);
  const [hasGoal, setHasGoal] = useState<boolean | null>(null);
  const [brainstormInterests, setBrainstormInterests] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const checkSessionAndGoal = async () => {
      try {
        const response = await fetch('/api/careers/sessions', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          if (data.sessions && data.sessions.length > 0) {
            const sessionData = data.sessions[0];
            setCurrentSession(sessionData);

            // Check if goal exists
            const goalResponse = await fetch(`/api/careers/goals?sessionId=${sessionData.id}`, { cache: 'no-store' });
            if (goalResponse.ok) {
              const goalData = await goalResponse.json();
              setHasGoal(!!goalData.goal);
              if (goalData.goal) {
                setCurrentGoal(goalData.goal);
              }
            }

            // If explore session with completed brainstorm, load interests
            if (sessionData.session_type === 'explore' && sessionData.brainstorm_complete) {
              const nodesResponse = await fetch(`/api/careers/brainstorm/nodes?sessionId=${sessionData.id}`, { cache: 'no-store' });
              if (nodesResponse.ok) {
                const nodesData = await nodesResponse.json();
                // Extract leaf node labels as interests
                const interests = nodesData.nodes
                  .filter((n: any) => !n.isRoot)
                  .map((n: any) => n.label);
                setBrainstormInterests(interests);
              }
            }
          } else {
            setCurrentSession(null);
          }
        } else {
          setCurrentSession(null);
        }
      } catch (error) {
        console.error('Error checking career session:', error);
        setCurrentSession(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkSessionAndGoal();
  }, []);

  const handleCreateSession = async (type: 'explore' | 'direct') => {
    try {
      const response = await fetch('/api/careers/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionType: type,
        }),
      });

      if (response.ok) {
        window.location.reload();
      } else {
        toast({
          title: 'Failed to start session',
          description: 'Please try again',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating session:', error);
      toast({
        title: 'Error',
        description: 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

  const handleBrainstormComplete = () => {
    window.location.reload();
  };

  const handleGoalComplete = () => {
    window.location.reload();
  };

  const handleAcademicProfileComplete = () => {
    window.location.reload();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoadingSpinner />
      </div>
    );
  }

  // 1. Welcome Screen
  if (!currentSession) {
    return <WelcomeScreen onCreateSession={handleCreateSession} />;
  }

  // 2. Brainstorming (only for 'explore' type and not yet complete)
  if (currentSession.session_type === 'explore' && !currentSession.brainstorm_complete) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Explore Your Interests</h1>
          <p className="text-muted-foreground">
            Click on any term to explore related career paths and academic subjects
          </p>
        </div>
        <BrainstormMindmap
          sessionId={currentSession.id}
          onComplete={handleBrainstormComplete}
        />
      </div>
    );
  }

  // 3. Goal Setting
  if (hasGoal === false) {
    return (
      <GoalSetting
        sessionId={currentSession.id}
        sessionType={currentSession.session_type}
        brainstormData={
          currentSession.session_type === 'explore'
            ? { interests: brainstormInterests }
            : undefined
        }
        onComplete={handleGoalComplete}
      />
    );
  }

  // 4. Academic Onboarding (New Step)
  if (!currentSession.academic_profile_complete) {
    return (
      <AcademicOnboarding
        sessionId={currentSession.id}
        onComplete={handleAcademicProfileComplete}
      />
    );
  }

  // 5. Dashboard
  if (currentGoal) {
    return (
      <PathwayDashboard
        sessionId={currentSession.id}
        universityName={currentGoal.university_name}
        courseName={currentGoal.course_name}
      />
    );
  }

  return <LoadingSpinner />;
}

interface WelcomeScreenProps {
  onCreateSession: (type: 'explore' | 'direct') => void;
}

function WelcomeScreen({ onCreateSession }: WelcomeScreenProps) {
  const [isCreating, setIsCreating] = useState<'explore' | 'direct' | null>(null);

  const handleClick = (type: 'explore' | 'direct') => {
    setIsCreating(type);
    onCreateSession(type);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Target className="w-12 h-12 text-primary" />
          </div>
        </div>
        <h1 className="text-4xl font-bold mb-4">Career Pathway Planning</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Discover your interests, set your university goals, and get a personalized pathway to achieve them.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card className="border-2 hover:border-primary transition-colors">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="w-6 h-6 text-primary" />
              <CardTitle>Help me explore</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Not sure what you want to study? Use our interactive brainstorming tool to discover career paths that match your interests.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <span>Interactive mindmap brainstorming</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <span>AI-powered career suggestions</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <span>University recommendations</span>
              </li>
            </ul>
            <Button
              onClick={() => handleClick('explore')}
              className="w-full"
              size="lg"
              disabled={!!isCreating}
            >
              {isCreating === 'explore' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                'Start Exploring'
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-2 hover:border-primary transition-colors">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Target className="w-6 h-6 text-primary" />
              <CardTitle>I know my goal</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Already know which university you want to attend? Jump straight to creating your personalized pathway.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <span>Set your university goal</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <span>Get month-by-month pathway</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <span>Link to Exammer topics</span>
              </li>
            </ul>
            <Button
              onClick={() => handleClick('direct')}
              variant="outline"
              className="w-full"
              size="lg"
              disabled={!!isCreating}
            >
              {isCreating === 'direct' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Setting up...
                </>
              ) : (
                'Set My Goal'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">What you'll get:</h3>
          <ul className="grid md:grid-cols-2 gap-3 text-sm">
            <li className="flex items-start gap-2">
              <ArrowRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <span>Personalized university pathway planning</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <span>Month-by-month action plan with milestones</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <span>Grade targets for each subject</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <span>Direct links to Exammer practice topics</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <span>Extracurricular recommendations</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <span>Adaptive replanning when things change</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}