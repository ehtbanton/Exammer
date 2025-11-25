"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { AuthGuard } from '@/components/AuthGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Target, Sparkles, ArrowRight } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import OnboardingWizard from '@/components/careers/OnboardingWizard';
import BrainstormMindmap from '@/components/careers/BrainstormMindmap';
import GoalSetting from '@/components/careers/GoalSetting';
import PathwayDashboard from '@/components/careers/PathwayDashboard';

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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingType, setOnboardingType] = useState<'explore' | 'direct'>('explore');

  useEffect(() => {
    const checkSessionAndGoal = async () => {
      try {
        const response = await fetch('/api/careers/sessions');
        if (response.ok) {
          const data = await response.json();
          if (data.sessions && data.sessions.length > 0) {
            const sessionData = data.sessions[0];
            setCurrentSession(sessionData);

            // Check if goal exists
            const goalResponse = await fetch(`/api/careers/goals?sessionId=${sessionData.id}`);
            if (goalResponse.ok) {
              const goalData = await goalResponse.json();
              setHasGoal(!!goalData.goal);
              if (goalData.goal) {
                setCurrentGoal(goalData.goal);
              }
            }

            // If explore session with completed brainstorm, load interests
            if (sessionData.session_type === 'explore' && sessionData.brainstorm_complete) {
              const nodesResponse = await fetch(`/api/careers/brainstorm/nodes?sessionId=${sessionData.id}`);
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

  const handleOnboardingComplete = (sessionId: number) => {
    setShowOnboarding(false);
    // Reload to show next step
    window.location.reload();
  };

  const handleBrainstormComplete = () => {
    // Reload to show goal setting
    window.location.reload();
  };

  const handleGoalComplete = () => {
    // Reload to show dashboard
    window.location.reload();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoadingSpinner />
      </div>
    );
  }

  // Show onboarding wizard if user selected a path
  if (showOnboarding) {
    return (
      <OnboardingWizard
        sessionType={onboardingType}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  // Show welcome screen if no session exists
  if (!currentSession) {
    return (
      <WelcomeScreen
        onStartExploring={() => {
          setOnboardingType('explore');
          setShowOnboarding(true);
        }}
        onKnowMyGoal={() => {
          setOnboardingType('direct');
          setShowOnboarding(true);
        }}
      />
    );
  }

  // Show brainstorming mindmap if explore session hasn't completed brainstorming
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

  // Show goal setting if session exists but no goal set yet
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

  // Show careers dashboard if session exists and goal is set
  if (currentGoal) {
    return (
      <PathwayDashboard
        sessionId={currentSession.id}
        universityName={currentGoal.university_name}
        courseName={currentGoal.course_name}
      />
    );
  }

  // Fallback (should not reach here)
  return <LoadingSpinner />;
}

interface WelcomeScreenProps {
  onStartExploring: () => void;
  onKnowMyGoal: () => void;
}

function WelcomeScreen({ onStartExploring, onKnowMyGoal }: WelcomeScreenProps) {

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
              onClick={onStartExploring}
              className="w-full"
              size="lg"
            >
              Start Exploring
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
              onClick={onKnowMyGoal}
              variant="outline"
              className="w-full"
              size="lg"
            >
              Set My Goal
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

