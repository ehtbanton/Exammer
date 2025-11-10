import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, BookOpen, Users, MessageSquare, Bot } from 'lucide-react';
import { UnderstandingIndicator } from '@/components/ui/understanding-indicator';
import { Progress } from '@/components/ui/progress';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Hero Section */}
      <div className="flex flex-col items-center pt-12 pb-8 px-4">
        <Link href="/workspace" className="flex flex-col items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity">
          <Image
            src="/exammer.png"
            alt="Exammer Logo"
            width={160}
            height={160}
            className="h-40 w-40"
          />

          <div className="flex flex-col items-center gap-2">
            <h1 className="text-5xl font-bold font-headline text-primary">
              Exammer
            </h1>
            <p className="text-xl text-muted-foreground">
              Get hooked on Revision
            </p>
          </div>
        </Link>

        {/* RAG for RAG Subheading */}
        <div className="mt-8 flex flex-col items-center gap-1">
          <h2 className="text-2xl font-semibold text-foreground">RAG for RAG</h2>
          <div className="flex flex-col items-center text-sm text-muted-foreground">
            <span className="tracking-wide">RETRIEVAL AUGMENTED GENERATION</span>
            <span className="tracking-wide">RED AMBER GREEN</span>
          </div>
        </div>

        {/* Product Description */}
        <p className="mt-6 max-w-3xl text-center text-lg text-muted-foreground px-4">
          Exammer is an AI framework that turns past papers for your course into a structured revision plan,
          using an interactive tutor and gamified progress tracking to replace guesswork with clarity.
        </p>

        <div className="mt-8">
          <Link href="/auth/signin">
            <Button size="lg" className="text-lg px-8 py-6">
              Get Started
            </Button>
          </Link>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <h2 className="text-3xl font-bold text-center mb-12">How Exammer Works</h2>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Understanding Levels */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Target className="h-8 w-8 text-primary" />
                <CardTitle>Understanding Levels</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Track your progress with Red, Amber, and Green markers. Every question is categorized by your
                understanding level, helping you focus on what needs improvement.
              </p>
              <div className="grid grid-cols-1 gap-3">
                {/* Red Level Example */}
                <div className="border-2 rounded-lg p-3" style={{backgroundColor: '#f87171', borderColor: '#dc2626'}}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-black">Calculus Integration</span>
                    <UnderstandingIndicator percentage={35} size="sm" />
                  </div>
                  <p className="text-xs text-black mt-1">3/8 attempted</p>
                  <Progress value={37.5} className="h-1.5 mt-2" />
                </div>
                {/* Amber Level Example */}
                <div className="border-2 rounded-lg p-3" style={{backgroundColor: '#fbbf24', borderColor: '#f59e0b'}}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-black">Algebra Equations</span>
                    <UnderstandingIndicator percentage={67} size="sm" />
                  </div>
                  <p className="text-xs text-black mt-1">5/6 attempted</p>
                  <Progress value={83} className="h-1.5 mt-2" />
                </div>
                {/* Green Level Example */}
                <div className="border-2 rounded-lg p-3" style={{backgroundColor: '#4ade80', borderColor: '#22c55e'}}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-black">Trigonometry Basics</span>
                    <UnderstandingIndicator percentage={92} size="sm" />
                  </div>
                  <p className="text-xs text-black mt-1">7/7 attempted</p>
                  <Progress value={100} className="h-1.5 mt-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* The Workspace */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <BookOpen className="h-8 w-8 text-primary" />
                <CardTitle>The Workspace</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Your personal study hub where subjects, topics, and questions are organized. Navigate through
                past papers, practice questions, and track your mastery of each topic.
              </p>
              <div className="grid grid-cols-1 gap-2">
                {/* Subject Card Example */}
                <div className="border rounded-lg p-3 bg-card hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Mathematics A-Level</span>
                  </div>
                  <p className="text-xs text-muted-foreground">3 paper types identified</p>
                </div>
                {/* Topic Navigation Example */}
                <div className="border rounded-lg p-3 bg-muted/50">
                  <div className="text-xs text-muted-foreground mb-2">Paper 1 → Pure Mathematics</div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">15 Topics</span>
                    <span className="text-xs">124 Questions</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Classrooms */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <CardTitle>Classrooms</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Join or create classrooms to collaborate with peers and teachers. Share progress,
                compare understanding levels, and work together towards exam success.
              </p>
              <div className="space-y-3">
                {/* Classroom Card Example */}
                <div className="border rounded-lg p-3 bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Year 12 Maths</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>24 students</span>
                    <span>Code: ABC123</span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">Class Average</div>
                  <div className="w-full bg-muted rounded-full h-2 mb-1">
                    <div className="bg-green-500 h-2 rounded-full" style={{width: '68%'}}></div>
                  </div>
                  <div className="text-xs text-muted-foreground">68% understanding</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Xam - The AI Tutor */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <MessageSquare className="h-8 w-8 text-primary" />
                <CardTitle>Xam - Your AI Tutor</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Meet Xam, your personal AI tutor. Get instant feedback, hints, and guidance as you work
                through questions. Xam tracks your objectives and helps you master each topic step by step.
              </p>
              <div className="bg-muted rounded-lg p-3 space-y-2">
                {/* User Message */}
                <div className="flex gap-2 justify-end">
                  <div className="bg-primary text-primary-foreground rounded-lg p-2 text-xs max-w-[80%]">
                    I got x = 5, is that correct?
                  </div>
                  <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-white text-xs font-bold shrink-0">U</div>
                </div>
                {/* Xam's Response */}
                <div className="flex gap-2">
                  <Bot className="w-6 h-6 text-primary shrink-0" />
                  <div className="bg-secondary text-secondary-foreground rounded-lg p-2 text-xs">
                    Great work! You've correctly solved for x = 5. That's objective 3 complete! Now try substituting this back into the original equation to verify.
                  </div>
                </div>
                {/* Objectives Progress */}
                <div className="flex items-center gap-2 text-xs pt-1">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-muted-foreground">3/4 objectives</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="container mx-auto px-4 py-12 text-center">
        <h3 className="text-2xl font-bold mb-4">Ready to transform your revision?</h3>
        <Link href="/auth/signup">
          <Button size="lg" variant="default" className="text-lg px-8 py-6">
            Sign Up Now
          </Button>
        </Link>
      </div>
    </div>
  );
}
