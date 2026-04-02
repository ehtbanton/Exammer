"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Trash2, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FinishQuestionDialogProps {
  isOpen: boolean;
  completedCount: number;
  totalCount: number;
  onSave: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

export function FinishQuestionDialog({
  isOpen,
  completedCount,
  totalCount,
  onSave,
  onDiscard,
  onClose,
}: FinishQuestionDialogProps) {
  if (!isOpen) return null;

  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[400px] max-w-[90vw]"
          >
            <div className="bg-[var(--s-surface-solid)] rounded-2xl [box-shadow:var(--s-shadow-lg)] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--s-border)]">
                <h2 className="text-[15px] font-semibold text-[var(--s-text)]">
                  Finish Question
                </h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--s-hover)] transition-colors text-[var(--s-text-muted)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 space-y-4">
                {/* Progress summary */}
                <div className="flex items-center gap-3 p-4 bg-[var(--s-card)] rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-[var(--s-icon-green-bg)] flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-[var(--s-success)]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-medium text-[var(--s-text)]">
                      {completedCount} of {totalCount} objectives completed
                    </p>
                    <p className="text-[12px] text-[var(--s-text-muted)]">
                      {progressPercent}% complete
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-[var(--s-surface)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--s-success)] transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <p className="text-[13px] text-[var(--s-text-secondary)]">
                  Would you like to save your progress or discard it?
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 px-5 pb-5">
                <button
                  onClick={onDiscard}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl",
                    "text-[13px] font-medium transition-all duration-200",
                    "bg-[var(--s-card)] text-[var(--s-text-secondary)]",
                    "hover:bg-[var(--s-danger-hover-bg)] hover:text-[var(--s-danger)]"
                  )}
                >
                  <Trash2 className="h-4 w-4" />
                  Discard
                </button>
                <button
                  onClick={onSave}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl",
                    "text-[13px] font-medium transition-all duration-200",
                    "bg-[var(--s-success)] text-white",
                    "hover:bg-[var(--s-success)]/90",
                    "[box-shadow:0_2px_8px_rgba(52,199,89,0.3)]"
                  )}
                >
                  <Save className="h-4 w-4" />
                  Save Progress
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
