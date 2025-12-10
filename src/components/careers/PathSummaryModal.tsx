"use client";

import { useState } from 'react';
import { Sparkles, ChevronRight, ArrowLeft, GraduationCap, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PathNode {
  id: string;
  label: string;
}

interface PathSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  path: PathNode[];
  onConfirm: () => void;
  isLoading?: boolean;
}

export function PathSummaryModal({
  isOpen,
  onClose,
  path,
  onConfirm,
  isLoading = false,
}: PathSummaryModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            Your Exploration Journey
          </DialogTitle>
          <DialogDescription>
            Review your path before getting personalized university recommendations
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {/* Path visualization */}
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-amber-400 via-amber-500 to-orange-500" />

            {/* Path nodes */}
            <div className="space-y-4">
              {path.map((node, index) => (
                <div
                  key={node.id}
                  className={cn(
                    "relative flex items-center gap-4 pl-12",
                    "animate-in fade-in slide-in-from-left-2",
                  )}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Node dot */}
                  <div className={cn(
                    "absolute left-2.5 h-5 w-5 rounded-full border-2 border-amber-500",
                    "flex items-center justify-center",
                    index === 0 && "bg-amber-500",
                    index === path.length - 1 && "bg-orange-500 border-orange-500",
                    index > 0 && index < path.length - 1 && "bg-white"
                  )}>
                    {index === 0 && (
                      <span className="text-white text-xs font-bold">1</span>
                    )}
                    {index === path.length - 1 && (
                      <GraduationCap className="h-3 w-3 text-white" />
                    )}
                  </div>

                  {/* Node content */}
                  <div className={cn(
                    "flex-1 p-3 rounded-lg border",
                    index === path.length - 1
                      ? "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300 dark:from-amber-950 dark:to-orange-950 dark:border-amber-700"
                      : "bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700"
                  )}>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-sm font-medium",
                        index === path.length - 1 && "text-amber-700 dark:text-amber-300"
                      )}>
                        {node.label}
                      </span>
                      {index < path.length - 1 && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    {index === 0 && (
                      <span className="text-xs text-muted-foreground">Starting point</span>
                    )}
                    {index === path.length - 1 && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">Current focus</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Info box */}
          <div className="mt-6 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>What happens next?</strong>
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
              Based on your exploration path, we'll suggest universities and programs
              that align with your interests. You can always come back to explore more!
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            onClick={onClose}
            variant="outline"
            className="gap-2"
            disabled={isLoading}
          >
            <ArrowLeft className="h-4 w-4" />
            Keep Exploring
          </Button>
          <Button
            onClick={onConfirm}
            className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Getting Recommendations...
              </>
            ) : (
              <>
                <GraduationCap className="h-4 w-4" />
                Get University Recommendations
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
