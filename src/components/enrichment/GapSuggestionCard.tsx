"use client";

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, ArrowRight } from 'lucide-react';

interface GapSuggestion {
  id: number;
  sourceSubjectName: string;
  topicName: string;
  topicDescription: string;
  confidenceScore: number;
}

interface GapSuggestionCardProps {
  gap: GapSuggestion;
  onDismiss: () => void;
}

export function GapSuggestionCard({ gap, onDismiss }: GapSuggestionCardProps) {
  const confidenceColor =
    gap.confidenceScore >= 80 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
    gap.confidenceScore >= 60 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
    'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';

  return (
    <Card className="relative group">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onDismiss}
      >
        <X className="h-3 w-3" />
      </Button>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-start gap-2 mb-2">
          <ArrowRight className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{gap.topicName}</p>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {gap.topicDescription}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">
            From: {gap.sourceSubjectName}
          </span>
          <Badge variant="outline" className={`text-xs ${confidenceColor}`}>
            {gap.confidenceScore}% match
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
