"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MousePointer2, Pencil, Eraser, Type, Scissors,
  Grid3X3, FileText, Trash2, Undo, Redo,
} from 'lucide-react';
import { rightToolbarVariants } from './animations';
import { cn } from '@/lib/utils';

export type DrawingTool = 'select' | 'draw' | 'eraser' | 'text';

interface VerticalToolbarProps {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  activeColor: string;
  onColorChange: (color: string) => void;
  onSnip: () => void;
  isSnipping: boolean;
  onToggleGrid: () => void;
  showGrid: boolean;
  onTogglePages: () => void;
  showPages: boolean;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const DRAWING_TOOLS: { id: DrawingTool; icon: React.ElementType; label: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select' },
  { id: 'draw', icon: Pencil, label: 'Draw' },
  { id: 'eraser', icon: Eraser, label: 'Eraser' },
  { id: 'text', icon: Type, label: 'Text' },
];

const COLORS = [
  { value: 'black', bg: 'bg-gray-900', ring: 'ring-gray-900' },
  { value: 'blue', bg: 'bg-blue-600', ring: 'ring-blue-600' },
  { value: 'red', bg: 'bg-red-500', ring: 'ring-red-500' },
  { value: 'green', bg: 'bg-green-600', ring: 'ring-green-600' },
  { value: 'orange', bg: 'bg-orange-500', ring: 'ring-orange-500' },
  { value: 'grey', bg: 'bg-gray-400', ring: 'ring-gray-400' },
];

function ToolButton({
  active,
  onClick,
  title,
  children,
  variant = 'default',
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  variant?: 'default' | 'danger';
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
        active && variant === 'default' && "bg-gray-100 text-blue-600",
        !active && variant === 'default' && "text-gray-600 hover:bg-gray-100",
        variant === 'danger' && "text-gray-500 hover:bg-red-50 hover:text-red-600",
      )}
    >
      {children}
    </button>
  );
}

export function VerticalToolbar({
  activeTool,
  onToolChange,
  activeColor,
  onColorChange,
  onSnip,
  isSnipping,
  onToggleGrid,
  showGrid,
  onTogglePages,
  showPages,
  onClear,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: VerticalToolbarProps) {
  return (
    <motion.div
      variants={rightToolbarVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="w-[52px] h-full bg-white border-l border-gray-200 flex flex-col items-center py-3 gap-1.5 shrink-0"
    >
      {/* Drawing Tools */}
      {DRAWING_TOOLS.map(({ id, icon: Icon, label }) => (
        <ToolButton
          key={id}
          active={activeTool === id}
          onClick={() => onToolChange(id)}
          title={label}
        >
          <Icon className="h-4 w-4" />
        </ToolButton>
      ))}

      {/* Snip */}
      <ToolButton
        active={isSnipping}
        onClick={onSnip}
        title="Snip selection"
      >
        <Scissors className="h-4 w-4" />
      </ToolButton>

      {/* Divider */}
      <div className="w-6 h-px bg-gray-200 my-1" />

      {/* Color Palette */}
      <div className="flex flex-col items-center gap-1.5">
        {COLORS.map(({ value, bg, ring }) => (
          <button
            key={value}
            onClick={() => onColorChange(value)}
            title={value}
            className={cn(
              "w-5 h-5 rounded-full transition-all",
              bg,
              activeColor === value && `ring-2 ${ring} ring-offset-2`,
            )}
          />
        ))}
      </div>

      {/* Divider */}
      <div className="w-6 h-px bg-gray-200 my-1" />

      {/* Canvas Controls */}
      <ToolButton
        active={showGrid}
        onClick={onToggleGrid}
        title="Toggle grid"
      >
        <Grid3X3 className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        active={showPages}
        onClick={onTogglePages}
        title="Toggle page boundaries"
      >
        <FileText className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        onClick={onClear}
        title="Clear canvas"
        variant="danger"
      >
        <Trash2 className="h-4 w-4" />
      </ToolButton>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Undo/Redo at bottom */}
      <ToolButton
        onClick={onUndo}
        title="Undo"
        active={false}
      >
        <Undo className={cn("h-4 w-4", !canUndo && "opacity-30")} />
      </ToolButton>
      <ToolButton
        onClick={onRedo}
        title="Redo"
        active={false}
      >
        <Redo className={cn("h-4 w-4", !canRedo && "opacity-30")} />
      </ToolButton>
    </motion.div>
  );
}
