"use client";

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { ChevronDown, ChevronUp, GripHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { collapseVariants } from './animations';

interface FloatingPanelProps {
  title: string;
  icon: React.ReactNode;
  defaultPosition: { x: number; y: number };
  children: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  defaultWidth?: number;
  defaultHeight?: number;
  resizable?: boolean;
  closable?: boolean;
  className?: string;
  zIndex?: number;
  onPositionChange?: (position: { x: number; y: number }) => void;
  onClose?: () => void;
}

export function FloatingPanel({
  title,
  icon,
  defaultPosition,
  children,
  collapsible = true,
  defaultCollapsed = false,
  minWidth = 280,
  maxWidth = 600,
  minHeight = 200,
  maxHeight = 600,
  defaultWidth,
  defaultHeight,
  resizable = true,
  closable = false,
  className,
  zIndex = 100,
  onPositionChange,
  onClose,
}: FloatingPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [size, setSize] = useState({
    width: defaultWidth || minWidth,
    height: defaultHeight || 300,
  });
  const constraintsRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Handle resize
  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;

    const handleMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      setSize({
        width: Math.min(maxWidth, Math.max(minWidth, startWidth + deltaX)),
        height: Math.min(maxHeight, Math.max(minHeight, startHeight + deltaY)),
      });
    };

    const handleUp = () => {
      setIsResizing(false);
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  }, [size, minWidth, maxWidth, minHeight, maxHeight]);

  return (
    <>
      {/* Invisible constraints container */}
      <div ref={constraintsRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: zIndex - 1 }} />

      <motion.div
        drag
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        dragElastic={0}
        dragConstraints={constraintsRef}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={(_, info) => {
          setIsDragging(false);
          onPositionChange?.({ x: info.point.x, y: info.point.y });
        }}
        initial={{ x: defaultPosition.x, y: defaultPosition.y }}
        className={cn(
          "fixed top-0 left-0 rounded-2xl overflow-hidden",
          "bg-white/90 dark:bg-gray-900/90",
          "backdrop-blur-xl",
          "border border-white/30 dark:border-gray-700/50",
          isDragging ? "shadow-2xl scale-[1.02]" : "shadow-lg",
          "transition-shadow",
          className
        )}
        ref={panelRef}
        style={{
          zIndex,
          width: size.width,
          height: isCollapsed ? 'auto' : size.height,
          minWidth,
          maxWidth,
          pointerEvents: 'auto',
        }}
      >
        {/* Header / Drag Handle */}
        <div
          onPointerDown={(e) => dragControls.start(e)}
          className={cn(
            "drag-handle flex items-center justify-between px-4 py-3",
            "bg-gradient-to-r from-gray-50/80 to-gray-100/80 dark:from-gray-800/80 dark:to-gray-850/80",
            "border-b border-gray-200/50 dark:border-gray-700/50",
            "cursor-grab active:cursor-grabbing",
            "select-none touch-none"
          )}
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="h-4 w-4 text-gray-400" />
            <span className="text-gray-500 dark:text-gray-400">{icon}</span>
            <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200">
              {title}
            </h3>
          </div>

          <div className="flex items-center gap-1">
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
            {closable && onClose && (
              <button
                onClick={onClose}
                className={cn(
                  "p-1 rounded-md transition-colors",
                  "hover:bg-red-100 dark:hover:bg-red-900/30",
                  "text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                )}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              variants={collapseVariants}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              className="overflow-hidden flex-1 flex flex-col"
              style={{ height: 'calc(100% - 52px)' }}
            >
              <div className="p-4 flex-1 flex flex-col min-h-0">
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Resize Handle */}
        {resizable && !isCollapsed && (
          <div
            onPointerDown={handleResizeStart}
            className={cn(
              "absolute bottom-0 right-0 w-4 h-4 cursor-se-resize",
              "flex items-center justify-center",
              "hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded-tl",
              isResizing && "bg-blue-200/50 dark:bg-blue-700/50"
            )}
            style={{ touchAction: 'none' }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              className="text-gray-400"
            >
              <path
                d="M9 1L1 9M9 5L5 9M9 9L9 9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}
      </motion.div>
    </>
  );
}
