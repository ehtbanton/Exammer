"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MousePointer2, Pencil, Eraser, Type, Scissors,
  Grid3X3, FileText, Trash2, Undo, Redo, Sun, Moon,
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
  studioTheme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const DRAWING_TOOLS: { id: DrawingTool; icon: React.ElementType; label: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select' },
  { id: 'draw', icon: Pencil, label: 'Draw' },
  { id: 'eraser', icon: Eraser, label: 'Eraser' },
  { id: 'text', icon: Type, label: 'Text' },
];

const COLORS = [
  { value: 'black', hex: '#1a1a1a' },
  { value: 'blue', hex: '#3478f6' },
  { value: 'red', hex: '#ff3b30' },
  { value: 'green', hex: '#34c759' },
  { value: 'orange', hex: '#ff9500' },
  { value: 'grey', hex: '#8e8e93' },
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
        active && variant === 'default' && "bg-[var(--s-tool-active-bg)] text-[var(--s-text)] [box-shadow:var(--s-tool-active-shadow)]",
        !active && variant === 'default' && "text-[var(--s-text-muted)] hover:text-[var(--s-text-secondary)] hover:bg-[var(--s-hover)]",
        variant === 'danger' && "text-[var(--s-text-muted)] hover:bg-[var(--s-danger-hover-bg)] hover:text-[var(--s-danger)]",
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
  studioTheme,
  onToggleTheme,
}: VerticalToolbarProps) {
  return (
    <motion.div
      variants={rightToolbarVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="w-[56px] h-full bg-[var(--s-surface)] backdrop-blur-xl flex flex-col items-center py-4 gap-1 shrink-0"
    >
      {/* Theme Toggle */}
      <ToolButton
        active={false}
        onClick={onToggleTheme}
        title={studioTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      >
        {studioTheme === 'light' ? (
          <Moon className="h-[18px] w-[18px]" />
        ) : (
          <Sun className="h-[18px] w-[18px]" />
        )}
      </ToolButton>

      {/* Divider */}
      <div className="w-7 my-1">
        <div className="h-px bg-gradient-to-r from-transparent via-[var(--s-divider)] to-transparent" />
      </div>

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
        <div className="h-px bg-gradient-to-r from-transparent via-[var(--s-divider)] to-transparent" />
      </div>

      {/* Color Palette */}
      <div className="flex flex-col items-center gap-2">
        {COLORS.map(({ value, hex }) => (
          <button
            key={value}
            onClick={() => onColorChange(value)}
            title={value}
            className="w-[18px] h-[18px] rounded-full transition-all duration-200"
            style={{
              backgroundColor: hex,
              boxShadow: activeColor === value
                ? `0 0 0 2px var(--s-surface-solid), 0 0 0 3.5px ${hex}`
                : undefined,
              transform: activeColor !== value ? undefined : undefined,
            }}
            onMouseEnter={(e) => {
              if (activeColor !== value) {
                (e.target as HTMLElement).style.transform = 'scale(1.1)';
              }
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.transform = '';
            }}
          />
        ))}
      </div>

      {/* Divider */}
      <div className="w-7 my-2">
        <div className="h-px bg-gradient-to-r from-transparent via-[var(--s-divider)] to-transparent" />
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
