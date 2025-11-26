"use client";

import { useState, useEffect } from 'react';
import { Sparkles, Loader2, Check, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface BrainstormNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: {
    id: string;
    label: string;
    isRoot: boolean;
    isExpanded: boolean;
    parentPath: string[];
  } | null;
  onExpand: () => Promise<void>;
  isExpanding: boolean;
}

type ModalState = 'initial' | 'expanding' | 'success';

export default function BrainstormNodeModal({
  isOpen,
  onClose,
  node,
  onExpand,
  isExpanding,
}: BrainstormNodeModalProps) {
  const [modalState, setModalState] = useState<ModalState>('initial');

  // Reset modal state when closed
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setModalState('initial');
      }, 300);
    }
  }, [isOpen]);

  // Track expanding state
  useEffect(() => {
    if (isExpanding) {
      setModalState('expanding');
    }
  }, [isExpanding]);

  const handleExpand = async () => {
    try {
      await onExpand();
      setModalState('success');
    } catch (error) {
      // Error is handled in parent component
      setModalState('initial');
    }
  };

  if (!node) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-[600px]">
        {/* Initial State */}
        {modalState === 'initial' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="h-6 w-6 text-primary" />
                {node.label}
              </DialogTitle>
              <DialogDescription>
                {node.isRoot
                  ? "This is your starting point. Click 'Explore this path' to discover related career paths and subjects."
                  : "Explore related areas and discover more specific career paths."}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Breadcrumb Path */}
              {node.parentPath.length > 0 && (
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Path:</p>
                  <div className="flex items-center flex-wrap gap-2 text-sm">
                    {node.parentPath.map((parent, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="font-medium">{parent}</span>
                        {index < node.parentPath.length && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    ))}
                    <span className="font-semibold text-primary">{node.label}</span>
                  </div>
                </div>
              )}

              {/* Expansion Status */}
              {node.isExpanded && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                    Already Expanded
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    This path has already been explored
                  </span>
                </div>
              )}

              {/* Info Section */}
              {!node.isExpanded && (
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>What happens when you explore?</strong>
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                    AI will suggest 5 related areas based on <strong>{node.label}</strong>.
                    These could include career paths, subjects, skills, or specializations.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={onClose} variant="outline">
                Close
              </Button>
              <Button
                onClick={handleExpand}
                disabled={node.isExpanded}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {node.isExpanded ? 'Already Explored' : 'Explore this path'}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Expanding State */}
        {modalState === 'expanding' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
                Generating Ideas...
              </DialogTitle>
              <DialogDescription>
                AI is exploring related areas based on {node.label}
              </DialogDescription>
            </DialogHeader>

            <div className="py-8 flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
              <p className="text-sm text-muted-foreground text-center">
                This may take a few moments...
              </p>
            </div>
          </>
        )}

        {/* Success State */}
        {modalState === 'success' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                Ideas Generated!
              </DialogTitle>
              <DialogDescription>
                New related areas have been added to your mindmap
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 space-y-4">
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4 rounded-lg">
                <p className="text-sm text-green-900 dark:text-green-100 mb-2">
                  <strong>Success!</strong>
                </p>
                <p className="text-sm text-green-800 dark:text-green-200">
                  Five related areas have been added. Click on any of them to continue exploring!
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={onClose} className="w-full">
                Continue Exploring
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
