"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Zap, BookOpen, Briefcase, HelpCircle, ArrowRight, Loader2, Link2, GraduationCap } from 'lucide-react';

interface TopicConnection {
  topicName: string;
  connectionStrength: 'strong' | 'moderate' | 'tangential';
  explanation: string;
  prerequisiteKnowledge: string[];
  newConceptsToLearn: string[];
}

interface SuggestedQuestion {
  question: string;
  difficulty: 'foundational' | 'intermediate' | 'advanced';
  hint: string;
}

interface BreakthroughAnalysis {
  overallImpact: string;
  topicConnections: TopicConnection[];
  studyPath: {
    immediateSteps: string[];
    deeperExploration: string[];
    practicalApplications: string[];
  };
  suggestedQuestions: SuggestedQuestion[];
  careerRelevance: string;
}

interface BreakthroughDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  breakthrough: {
    id: number;
    title: string;
    summary: string;
    source: string;
    relevance: string;
    field: string;
    confidenceScore: number;
  } | null;
  subjectId: string;
}

export function BreakthroughDetailDialog({
  open,
  onOpenChange,
  breakthrough,
  subjectId,
}: BreakthroughDetailDialogProps) {
  const [analysis, setAnalysis] = useState<BreakthroughAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && breakthrough && !analysis) {
      fetchAnalysis();
    }
  }, [open, breakthrough]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setAnalysis(null);
      setError(null);
    }
  }, [open]);

  const fetchAnalysis = async () => {
    if (!breakthrough) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/enrichment/analyze-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId,
          breakthroughId: breakthrough.id,
          breakthroughTitle: breakthrough.title,
          breakthroughSummary: breakthrough.summary,
          breakthroughSource: breakthrough.source,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
      } else {
        setError('Failed to analyze connection');
      }
    } catch {
      setError('Failed to analyze connection');
    } finally {
      setIsLoading(false);
    }
  };

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'strong':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'tangential':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      default:
        return '';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'foundational':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'intermediate':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'advanced':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return '';
    }
  };

  if (!breakthrough) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            {breakthrough.title}
          </DialogTitle>
          <DialogDescription>
            {breakthrough.summary}
          </DialogDescription>
        </DialogHeader>

        <div className="text-sm text-muted-foreground mb-4">
          <strong>Source:</strong> {breakthrough.source}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            <p className="text-muted-foreground">Analyzing how this connects to your curriculum...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-destructive">{error}</p>
          </div>
        ) : analysis ? (
          <Tabs defaultValue="connections" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="connections" className="text-xs sm:text-sm">
                <Link2 className="h-4 w-4 mr-1 hidden sm:inline" />
                Connections
              </TabsTrigger>
              <TabsTrigger value="study" className="text-xs sm:text-sm">
                <BookOpen className="h-4 w-4 mr-1 hidden sm:inline" />
                Study Path
              </TabsTrigger>
              <TabsTrigger value="practice" className="text-xs sm:text-sm">
                <HelpCircle className="h-4 w-4 mr-1 hidden sm:inline" />
                Practice
              </TabsTrigger>
              <TabsTrigger value="career" className="text-xs sm:text-sm">
                <Briefcase className="h-4 w-4 mr-1 hidden sm:inline" />
                Career
              </TabsTrigger>
            </TabsList>

            <TabsContent value="connections" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Overall Impact</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{analysis.overallImpact}</p>
                </CardContent>
              </Card>

              {analysis.topicConnections.length > 0 ? (
                <Accordion type="single" collapsible className="w-full">
                  {analysis.topicConnections.map((connection, index) => (
                    <AccordionItem key={index} value={`topic-${index}`}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 text-purple-500" />
                          <span>{connection.topicName}</span>
                          <Badge variant="outline" className={`ml-2 ${getStrengthColor(connection.connectionStrength)}`}>
                            {connection.connectionStrength}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pl-6">
                        <p className="text-sm">{connection.explanation}</p>

                        {connection.prerequisiteKnowledge.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              What you already know that helps:
                            </p>
                            <ul className="text-sm space-y-1">
                              {connection.prerequisiteKnowledge.map((prereq, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-green-500 mt-1">✓</span>
                                  {prereq}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {connection.newConceptsToLearn.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              New concepts to learn:
                            </p>
                            <ul className="text-sm space-y-1">
                              {connection.newConceptsToLearn.map((concept, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <ArrowRight className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                                  {concept}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <p className="text-muted-foreground text-sm">No direct topic connections found.</p>
              )}
            </TabsContent>

            <TabsContent value="study" className="space-y-4 mt-4">
              {analysis.studyPath.immediateSteps.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <span className="text-green-500">1.</span> Start Here
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analysis.studyPath.immediateSteps.map((step, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <ArrowRight className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          {step}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {analysis.studyPath.deeperExploration.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <span className="text-blue-500">2.</span> Go Deeper
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analysis.studyPath.deeperExploration.map((step, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <ArrowRight className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                          {step}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {analysis.studyPath.practicalApplications.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <span className="text-purple-500">3.</span> Apply It
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analysis.studyPath.practicalApplications.map((step, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <ArrowRight className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                          {step}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="practice" className="space-y-4 mt-4">
              {analysis.suggestedQuestions.length > 0 ? (
                analysis.suggestedQuestions.map((q, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">Question {i + 1}</CardTitle>
                        <Badge variant="outline" className={getDifficultyColor(q.difficulty)}>
                          {q.difficulty}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm font-medium">{q.question}</p>
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer hover:text-foreground">Show hint</summary>
                        <p className="mt-1 pl-2 border-l-2 border-muted">{q.hint}</p>
                      </details>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">No practice questions available.</p>
              )}
            </TabsContent>

            <TabsContent value="career" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-blue-500" />
                    Career Impact
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{analysis.careerRelevance}</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
