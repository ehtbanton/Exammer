"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, RefreshCw, Sparkles, BookOpen, Zap } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { GapSuggestionCard } from './GapSuggestionCard';
import { BreakthroughCard } from './BreakthroughCard';

interface GapSuggestion {
  id: number;
  sourceSubjectName: string;
  sourceSubjectId: number;
  topicName: string;
  topicDescription: string;
  field: string;
  confidenceScore: number;
  createdAt: number;
}

interface BreakthroughSuggestion {
  id: number;
  title: string;
  summary: string;
  source: string;
  relevance: string;
  field: string;
  confidenceScore: number;
  createdAt: number;
  expiresAt: number | null;
}

interface EnrichmentData {
  gaps: GapSuggestion[];
  breakthroughs: BreakthroughSuggestion[];
  enrichmentType: 'gap' | 'breakthrough' | 'none';
}

interface EnrichmentPanelProps {
  subjectId: string;
}

export function EnrichmentPanel({ subjectId }: EnrichmentPanelProps) {
  const [data, setData] = useState<EnrichmentData | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEnrichment = useCallback(async () => {
    try {
      const res = await fetch(`/api/enrichment?subjectId=${subjectId}`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
        setError(null);
      } else {
        setError('Failed to load enrichment suggestions');
      }
    } catch {
      setError('Failed to load enrichment suggestions');
    } finally {
      setIsLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    fetchEnrichment();
  }, [fetchEnrichment]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/enrichment/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId }),
      });
      if (res.ok) {
        await fetchEnrichment();
      }
    } catch {
      // Silently fail - user can try again
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDismiss = async (suggestionId: number) => {
    try {
      const res = await fetch('/api/enrichment/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId }),
      });
      if (res.ok) {
        setData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            gaps: prev.gaps.filter(g => g.id !== suggestionId),
            breakthroughs: prev.breakthroughs.filter(b => b.id !== suggestionId),
            enrichmentType: prev.enrichmentType,
          };
        });
      }
    } catch {
      // Silently fail
    }
  };

  if (isLoading) {
    return null; // Don't show anything while loading
  }

  if (error) {
    return null; // Don't show error state - enrichment is supplementary
  }

  const hasContent = data && (data.gaps.length > 0 || data.breakthroughs.length > 0);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-8">
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-purple-500" />
                Curriculum Enrichment
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRefresh();
                  }}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? <LoadingSpinner /> : <RefreshCw className="h-4 w-4" />}
                </Button>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {!hasContent ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-3">
                  No enrichment suggestions yet. Click refresh to analyze your curriculum.
                </p>
                <Button
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? <LoadingSpinner /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Analyze Curriculum
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {data.gaps.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Topics from Similar Courses
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      These topics are covered by similar courses on the platform but may be missing from yours.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {data.gaps.map(gap => (
                        <GapSuggestionCard
                          key={gap.id}
                          gap={gap}
                          onDismiss={() => handleDismiss(gap.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {data.breakthroughs.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Recent Developments in {data.breakthroughs[0]?.field}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Recent breakthroughs and industry developments you should know about.
                    </p>
                    <div className="grid grid-cols-1 gap-3">
                      {data.breakthroughs.map(bt => (
                        <BreakthroughCard
                          key={bt.id}
                          breakthrough={bt}
                          onDismiss={() => handleDismiss(bt.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
