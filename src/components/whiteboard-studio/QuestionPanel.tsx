"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { FileQuestion, Check, Circle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { LatexRenderer } from '@/components/latex-renderer';
import { FloatingPanel } from './FloatingPanel';
import { questionPanelVariants } from './animations';
import { cn } from '@/lib/utils';

interface QuestionPanelProps {
  questionText: string;
  objectives: string[];
  completedObjectives: number[];
  defaultPosition?: { x: number; y: number };
  defaultCollapsed?: boolean;
}

export function QuestionPanel({
  questionText,
  objectives,
  completedObjectives,
  defaultPosition = { x: 20, y: 70 },
  defaultCollapsed = false,
}: QuestionPanelProps) {
  const completedCount = completedObjectives.length;
  const totalCount = objectives.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <motion.div
      variants={questionPanelVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <FloatingPanel
        title="Question"
        icon={<FileQuestion className="h-4 w-4" />}
        defaultPosition={defaultPosition}
        defaultCollapsed={defaultCollapsed}
        minWidth={300}
        maxWidth={550}
        minHeight={250}
        maxHeight={600}
        defaultWidth={380}
        defaultHeight={400}
        resizable={true}
        zIndex={105}
      >
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          {/* Progress Section */}
          <div className="space-y-2 shrink-0 mb-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Progress
              </span>
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {completedCount}/{totalCount} objectives
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-2 space-y-3">
            {/* Question Text */}
            <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              <LatexRenderer>{questionText}</LatexRenderer>
            </div>

            {/* Objectives List */}
            {objectives.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Objectives
                </h4>
                <ul className="space-y-1.5">
                  {objectives.map((objective, index) => {
                    const isCompleted = completedObjectives.includes(index);
                    return (
                      <li
                        key={index}
                        className={cn(
                          "flex items-start gap-2 text-xs p-2 rounded-lg transition-colors",
                          isCompleted
                            ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                            : "bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400"
                        )}
                      >
                        {isCompleted ? (
                          <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-green-500" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gray-400" />
                        )}
                        <span className="line-clamp-2">{objective}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      </FloatingPanel>
    </motion.div>
  );
}
