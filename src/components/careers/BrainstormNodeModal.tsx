"use client";

import { useState, useEffect } from 'react';
import { Sparkles, Loader2, Check, ChevronRight, Star, Focus } from 'lucide-react';
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
import { cn } from '@/lib/utils';

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
  onSelect?: () => void;
  isOnSelectedPath?: boolean;
}

type ModalState = 'initial' | 'expanding' | 'success';

export default function BrainstormNodeModal({
  isOpen,
  onClose,
  node,
  onExpand,
  isExpanding,
  onSelect,
  isOnSelectedPath = false,
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

  const handleSelectAndExpand = async () => {
    // First select the node on the golden path
    if (onSelect) {
      onSelect();
    }
    // Then expand it
    await handleExpand();
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
                {isOnSelectedPath ? (
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <Star className="h-4 w-4 text-white fill-white" />
                  </div>
                ) : (
                  <Sparkles className="h-6 w-6 text-primary" />
                )}
                {node.label}
              </DialogTitle>
              <DialogDescription>
                {node.isRoot
                  ? "This is your starting point. Explore to discover related career paths and subjects."
                  : isOnSelectedPath
                  ? "This is on your golden path. Continue exploring from here!"
                  : "Select this to add it to your path, or just explore without selecting."}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Golden Path Badge */}
              {isOnSelectedPath && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                    <Star className="h-3 w-3 mr-1 fill-white" />
                    On Your Path
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    This is part of your exploration journey
                  </span>
                </div>
              )}

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
                    <span className={cn(
                      "font-semibold",
                      isOnSelectedPath ? "text-amber-600" : "text-primary"
                    )}>
                      {node.label}
                    </span>
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
                <div className={cn(
                  "p-4 rounded-lg border",
                  isOnSelectedPath
                    ? "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800"
                    : "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
                )}>
                  <p className={cn(
                    "text-sm",
                    isOnSelectedPath
                      ? "text-amber-900 dark:text-amber-100"
                      : "text-blue-900 dark:text-blue-100"
                  )}>
                    <strong>What happens when you explore?</strong>
                  </p>
                  <p className={cn(
                    "text-sm mt-1",
                    isOnSelectedPath
                      ? "text-amber-800 dark:text-amber-200"
                      : "text-blue-800 dark:text-blue-200"
                  )}>
                    AI will suggest 5 related areas based on <strong>{node.label}</strong>.
                    These could include career paths, subjects, skills, or specializations.
                  </p>
                </div>
              )}

              {/* Selection hint for non-selected nodes */}
              {!isOnSelectedPath && !node.isRoot && !node.isExpanded && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                  <p className="text-sm text-amber-900 dark:text-amber-100">
                    <strong><Star className="h-4 w-4 inline mr-1" />Tip: Select & Explore</strong>
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                    Add this to your "golden path" to track your interests. This helps generate better recommendations later!
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button onClick={onClose} variant="outline">
                Close
              </Button>

              {/* Show different buttons based on state */}
              {!node.isExpanded && (
                <>
                  {/* Just explore without selecting */}
                  {!isOnSelectedPath && !node.isRoot && (
                    <Button
                      onClick={handleExpand}
                      variant="secondary"
                      className="gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      Just Explore
                    </Button>
                  )}

                  {/* Select and explore - primary action for non-root, non-selected nodes */}
                  {!isOnSelectedPath && !node.isRoot ? (
                    <Button
                      onClick={handleSelectAndExpand}
                      className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                    >
                      <Star className="h-4 w-4" />
                      Select & Explore
                    </Button>
                  ) : (
                    <Button
                      onClick={handleExpand}
                      className="gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      Explore this path
                    </Button>
                  )}
                </>
              )}

              {node.isExpanded && !isOnSelectedPath && !node.isRoot && onSelect && (
                <Button
                  onClick={() => {
                    onSelect();
                    onClose();
                  }}
                  className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                >
                  <Star className="h-4 w-4" />
                  Add to My Path
                </Button>
              )}
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

              {/* Remind about selection */}
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                <p className="text-sm text-amber-900 dark:text-amber-100">
                  <Star className="h-4 w-4 inline mr-1" />
                  <strong>Next step:</strong>
                </p>
                <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                  Click on the ideas that interest you most to add them to your golden path!
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
