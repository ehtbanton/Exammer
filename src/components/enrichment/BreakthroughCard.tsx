"use client";

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Zap, ChevronRight } from 'lucide-react';

interface BreakthroughSuggestion {
  id: number;
  title: string;
  summary: string;
  source: string;
  relevance: string;
  confidenceScore: number;
  field?: string;
}

interface BreakthroughCardProps {
  breakthrough: BreakthroughSuggestion;
  onDismiss: () => void;
  onClick?: () => void;
}

export function BreakthroughCard({ breakthrough, onDismiss, onClick }: BreakthroughCardProps) {
  // Map confidence score to employability impact
  const impact =
    breakthrough.confidenceScore >= 80 ? 'high' :
    breakthrough.confidenceScore >= 60 ? 'medium' : 'low';

  const impactConfig = {
    high: { label: 'High Impact', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300' },
    medium: { label: 'Medium Impact', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300' },
    low: { label: 'Low Impact', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300' },
  };

  const config = impactConfig[impact];

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking the dismiss button
    if ((e.target as HTMLElement).closest('button')) return;
    onClick?.();
  };

  return (
    <Card
      className={`relative group border-l-4 border-l-purple-500 transition-all ${onClick ? 'cursor-pointer hover:shadow-md hover:border-l-purple-600' : ''}`}
      onClick={handleCardClick}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
      >
        <X className="h-3 w-3" />
      </Button>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-start gap-2 mb-2">
          <Zap className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0 pr-6">
            <p className="font-medium text-sm">{breakthrough.title}</p>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {breakthrough.summary}
            </p>
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <p className="text-xs text-muted-foreground line-clamp-1">
            <span className="font-medium">Source:</span> {breakthrough.source}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-1">
            <span className="font-medium">Why it matters:</span> {breakthrough.relevance}
          </p>
        </div>
        <div className="flex items-center justify-between mt-3">
          {onClick && (
            <span className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1 group-hover:underline">
              See how this connects
              <ChevronRight className="h-3 w-3" />
            </span>
          )}
          <Badge variant="outline" className={`text-xs ${config.className} ${onClick ? '' : 'ml-auto'}`}>
            {config.label}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
