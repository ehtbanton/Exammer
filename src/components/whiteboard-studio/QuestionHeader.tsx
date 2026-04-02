"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Check, Circle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { LatexRenderer } from '@/components/latex-renderer';
import { AIDiagram } from './AIDiagram';
import { cn } from '@/lib/utils';

interface QuestionHeaderProps {
  questionText: string;
  objectives: string[];
  completedObjectives: number[];
  diagramDescription?: string;
}

export function QuestionHeader({
  questionText,
  objectives,
  completedObjectives,
  diagramDescription,
}: QuestionHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const completedCount = completedObjectives.length;
  const totalCount = objectives.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isCompleted = completedCount === totalCount && totalCount > 0;

  return (
    <div className="bg-[var(--s-surface)] border-b border-[var(--s-border)] shrink-0">
      {/* Header Bar - Always Visible */}
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Progress Badge */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium shrink-0",
            isCompleted
              ? "bg-[var(--s-icon-green-bg)] text-[var(--s-success)]"
              : "bg-[var(--s-card)] text-[var(--s-text-secondary)]"
          )}>
            {isCompleted ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Circle className="h-3.5 w-3.5" />
            )}
            <span>{completedCount}/{totalCount}</span>
          </div>

          {/* Progress Bar */}
          <div className="flex-1 max-w-[200px]">
            <Progress value={progressPercent} className="h-1.5" />
          </div>

          {/* Question Preview (collapsed state) */}
          {!isExpanded && (
            <p className="text-[13px] text-[var(--s-text-muted)] truncate flex-1">
              {questionText.substring(0, 100)}...
            </p>
          )}
        </div>

        {/* Expand/Collapse Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-[var(--s-text-muted)] hover:bg-[var(--s-hover)] transition-all duration-200"
        >
          <span>{isExpanded ? 'Collapse' : 'Show Question'}</span>
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Expanded Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4">
              <div className="flex gap-5">
                {/* Question Text */}
                <div className="flex-1 max-h-[30vh] overflow-y-auto studio-scrollbar pr-2">
                  <div className="text-[14px] text-[var(--s-text)] leading-relaxed">
                    <LatexRenderer>{questionText}</LatexRenderer>
                  </div>
                </div>

                {/* Diagram (if available) */}
                {diagramDescription && (
                  <div className="w-[280px] shrink-0">
                    <AIDiagram description={diagramDescription} />
                  </div>
                )}
              </div>

              {/* Objectives - Horizontal Pills */}
              {objectives.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {objectives.map((objective, index) => {
                    const isObjCompleted = completedObjectives.includes(index);
                    return (
                      <div
                        key={index}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] transition-all duration-200",
                          isObjCompleted
                            ? "bg-[var(--s-completed-bg)] text-[var(--s-completed-text)]"
                            : "bg-[var(--s-objective-bg)] text-[var(--s-objective-text)]"
                        )}
                        title={objective}
                      >
                        {isObjCompleted ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Circle className="h-3 w-3" />
                        )}
                        <span className="max-w-[200px] truncate">
                          {objective.length > 40 ? objective.substring(0, 40) + '...' : objective}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
