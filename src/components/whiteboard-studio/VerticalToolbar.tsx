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
  { value: 'black', bg: 'bg-[#1a1a1a]', shadow: 'shadow-[0_0_0_2px_#f5f5f5,0_0_0_3.5px_#1a1a1a]' },
  { value: 'blue', bg: 'bg-[#3478f6]', shadow: 'shadow-[0_0_0_2px_#f5f5f5,0_0_0_3.5px_#3478f6]' },
  { value: 'red', bg: 'bg-[#ff3b30]', shadow: 'shadow-[0_0_0_2px_#f5f5f5,0_0_0_3.5px_#ff3b30]' },
  { value: 'green', bg: 'bg-[#34c759]', shadow: 'shadow-[0_0_0_2px_#f5f5f5,0_0_0_3.5px_#34c759]' },
  { value: 'orange', bg: 'bg-[#ff9500]', shadow: 'shadow-[0_0_0_2px_#f5f5f5,0_0_0_3.5px_#ff9500]' },
  { value: 'grey', bg: 'bg-[#8e8e93]', shadow: 'shadow-[0_0_0_2px_#f5f5f5,0_0_0_3.5px_#8e8e93]' },
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
        "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200",
        active && variant === 'default' && "bg-white/90 text-[#1a1a1a] shadow-[0_0.5px_1px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.06)]",
        !active && variant === 'default' && "text-[#8e8e93] hover:text-[#555] hover:bg-white/60",
        variant === 'danger' && "text-[#8e8e93] hover:bg-[#fff5f5] hover:text-[#ff3b30]",
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
      className="w-[56px] h-full bg-[#f5f5f5]/80 backdrop-blur-xl flex flex-col items-center py-4 gap-1 shrink-0"
    >
      {/* Drawing Tools */}
      {DRAWING_TOOLS.map(({ id, icon: Icon, label }) => (
        <ToolButton
          key={id}
          active={activeTool === id}
          onClick={() => onToolChange(id)}
          title={label}
        >
          <Icon className="h-[18px] w-[18px]" />
        </ToolButton>
      ))}

      {/* Snip */}
      <ToolButton
        active={isSnipping}
        onClick={onSnip}
        title="Snip selection"
      >
        <Scissors className="h-[18px] w-[18px]" />
      </ToolButton>

      {/* Divider */}
      <div className="w-7 my-2">
        <div className="h-px bg-gradient-to-r from-transparent via-[#e0e0e0] to-transparent" />
      </div>

      {/* Color Palette */}
      <div className="flex flex-col items-center gap-2">
        {COLORS.map(({ value, bg, shadow }) => (
          <button
            key={value}
            onClick={() => onColorChange(value)}
            title={value}
            className={cn(
              "w-[18px] h-[18px] rounded-full transition-all duration-200",
              bg,
              activeColor === value ? shadow : "hover:scale-110",
            )}
          />
        ))}
      </div>

      {/* Divider */}
      <div className="w-7 my-2">
        <div className="h-px bg-gradient-to-r from-transparent via-[#e0e0e0] to-transparent" />
      </div>

      {/* Canvas Controls */}
      <ToolButton
        active={showGrid}
        onClick={onToggleGrid}
        title="Toggle grid"
      >
        <Grid3X3 className="h-[18px] w-[18px]" />
      </ToolButton>
      <ToolButton
        active={showPages}
        onClick={onTogglePages}
        title="Toggle page boundaries"
      >
        <FileText className="h-[18px] w-[18px]" />
      </ToolButton>
      <ToolButton
        onClick={onClear}
        title="Clear canvas"
        variant="danger"
      >
        <Trash2 className="h-[18px] w-[18px]" />
      </ToolButton>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Undo/Redo at bottom */}
      <ToolButton
        onClick={onUndo}
        title="Undo"
        active={false}
      >
        <Undo className={cn("h-[18px] w-[18px]", !canUndo && "opacity-25")} />
      </ToolButton>
      <ToolButton
        onClick={onRedo}
        title="Redo"
        active={false}
      >
        <Redo className={cn("h-[18px] w-[18px]", !canRedo && "opacity-25")} />
      </ToolButton>
    </motion.div>
  );
}
