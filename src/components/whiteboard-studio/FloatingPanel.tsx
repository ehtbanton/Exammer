"use client";

import React, { useState, useRef } from 'react';
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, GripHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { collapseVariants, dragVariants } from './animations';

interface FloatingPanelProps {
  title: string;
  icon: React.ReactNode;
  defaultPosition: { x: number; y: number };
  children: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
  zIndex?: number;
  onPositionChange?: (position: { x: number; y: number }) => void;
}

export function FloatingPanel({
  title,
  icon,
  defaultPosition,
  children,
  collapsible = true,
  defaultCollapsed = false,
  minWidth = 280,
  maxWidth = 400,
  className,
  zIndex = 100,
  onPositionChange,
}: FloatingPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isDragging, setIsDragging] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragStop = (_e: DraggableEvent, data: DraggableData) => {
    setIsDragging(false);
    onPositionChange?.({ x: data.x, y: data.y });
  };

  return (
    <Draggable
      nodeRef={nodeRef}
      defaultPosition={defaultPosition}
      handle=".drag-handle"
      bounds="parent"
      onStart={handleDragStart}
      onStop={handleDragStop}
    >
      <motion.div
        ref={nodeRef}
        className={cn(
          "absolute rounded-2xl overflow-hidden",
          "bg-white/90 dark:bg-gray-900/90",
          "backdrop-blur-xl",
          "border border-white/30 dark:border-gray-700/50",
          "shadow-lg",
          className
        )}
        style={{
          zIndex,
          minWidth,
          maxWidth,
        }}
        initial="idle"
        animate={isDragging ? "dragging" : "idle"}
        variants={dragVariants}
      >
        {/* Header / Drag Handle */}
        <div
          className={cn(
            "drag-handle flex items-center justify-between px-4 py-3",
            "bg-gradient-to-r from-gray-50/80 to-gray-100/80 dark:from-gray-800/80 dark:to-gray-850/80",
            "border-b border-gray-200/50 dark:border-gray-700/50",
            "cursor-grab active:cursor-grabbing",
            "select-none"
          )}
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="h-4 w-4 text-gray-400" />
            <span className="text-gray-500 dark:text-gray-400">{icon}</span>
            <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200">
              {title}
            </h3>
          </div>

          {collapsible && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={cn(
                "p-1 rounded-md transition-colors",
                "hover:bg-gray-200/50 dark:hover:bg-gray-700/50",
                "text-gray-500 dark:text-gray-400"
              )}
            >
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* Content */}
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              variants={collapseVariants}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              className="overflow-hidden"
            >
              <div className="p-4">
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </Draggable>
  );
}
