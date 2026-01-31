"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { X, Send, Trash2, Undo, Redo, ZoomIn, ZoomOut, Maximize2, Tag, Scissors, Grid3X3, FileText, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toolbarVariants } from './animations';
import { WidgetMenu, WidgetType } from './WidgetMenu';
import { cn } from '@/lib/utils';

interface StudioToolbarProps {
  onExit: () => void;
  onSubmit: () => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onLabelImage: () => void;
  onSnip: () => void;
  onNextStep: () => void;
  hasIncompleteObjectives: boolean;
  onAddWidget: (type: WidgetType) => void;
  activeWidgets: WidgetType[];
  onToggleGrid: () => void;
  showGrid: boolean;
  onTogglePages: () => void;
  showPages: boolean;
  isSubmitting?: boolean;
  isSnipping?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
}

export function StudioToolbar({
  onExit,
  onSubmit,
  onClear,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onLabelImage,
  onSnip,
  onNextStep,
  hasIncompleteObjectives,
  onAddWidget,
  activeWidgets,
  onToggleGrid,
  showGrid,
  onTogglePages,
  showPages,
  isSubmitting = false,
  isSnipping = false,
  canUndo = true,
  canRedo = false,
}: StudioToolbarProps) {
  return (
    <motion.div
      variants={toolbarVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={cn(
        "fixed bottom-20 left-1/2 -translate-x-1/2 z-[120]",
        "flex items-center gap-1 p-2",
        "bg-white/95 dark:bg-gray-900/95",
        "backdrop-blur-xl",
        "border border-gray-200/50 dark:border-gray-700/50",
        "rounded-2xl shadow-2xl"
      )}
    >
      {/* Exit Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onExit}
        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
      >
        <X className="h-4 w-4 mr-1" />
        Exit
      </Button>

      <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

      {/* Undo/Redo */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onUndo}
        disabled={!canUndo}
        className="h-9 w-9"
        title="Undo"
      >
        <Undo className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onRedo}
        disabled={!canRedo}
        className="h-9 w-9"
        title="Redo"
      >
        <Redo className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

      {/* Zoom Controls */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onZoomOut}
        className="h-9 w-9"
        title="Zoom Out"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onResetZoom}
        className="h-9 w-9"
        title="Reset Zoom"
      >
        <Maximize2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onZoomIn}
        className="h-9 w-9"
        title="Zoom In"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

      {/* Text Tool */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onLabelImage}
        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        title="Add text label"
      >
        <Tag className="h-4 w-4 mr-1" />
        Text
      </Button>

      {/* Snipping Tool */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onSnip}
        className={cn(
          isSnipping
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        )}
        title="Snip selection"
      >
        <Scissors className="h-4 w-4 mr-1" />
        Snip
      </Button>

      {/* Next Step Tool */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onNextStep}
        disabled={!hasIncompleteObjectives || isSubmitting}
        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        title="Get help with the next step"
      >
        <ArrowRight className="h-4 w-4 mr-1" />
        Next
      </Button>

      {/* Widget Menu */}
      <WidgetMenu onAddWidget={onAddWidget} activeWidgets={activeWidgets} />

      <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

      {/* Canvas Options */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleGrid}
        className={cn(
          "h-9 w-9",
          showGrid && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
        )}
        title="Toggle Grid"
      >
        <Grid3X3 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onTogglePages}
        className={cn(
          "h-9 w-9",
          showPages && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
        )}
        title="Toggle Page Boundaries"
      >
        <FileText className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

      {/* Clear Canvas */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
      >
        <Trash2 className="h-4 w-4 mr-1" />
        Clear
      </Button>

      <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

      {/* Submit Button */}
      <Button
        size="sm"
        onClick={onSubmit}
        disabled={isSubmitting}
        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-4"
      >
        <Send className="h-4 w-4 mr-1" />
        {isSubmitting ? 'Sending...' : 'Submit Answer'}
      </Button>
    </motion.div>
  );
}
