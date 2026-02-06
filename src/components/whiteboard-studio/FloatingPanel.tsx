"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls, LayoutGroup } from 'framer-motion';
import { ChevronDown, ChevronUp, GripHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { collapseVariants } from './animations';

// Snapping constants - only snap to top and left edges
const SNAP_THRESHOLD = 40;
const SNAP_MARGIN = 10;

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
  squareMinimize?: boolean;
  minimizedIcon?: React.ReactNode;
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
  squareMinimize = false,
  minimizedIcon,
  className,
  zIndex = 100,
  onPositionChange,
  onClose,
}: FloatingPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [position, setPosition] = useState(defaultPosition);
  const [size, setSize] = useState({
    width: defaultWidth || minWidth,
    height: defaultHeight || 300,
  });
  const constraintsRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Calculate snapped position - only snap to TOP and LEFT edges
  const calculateSnappedPosition = useCallback((x: number, y: number) => {
    if (typeof window === 'undefined') return { x, y };

    let sx = x;
    let sy = y;

    // Snap to left edge (magnetic effect)
    if (x < SNAP_THRESHOLD) {
      sx = SNAP_MARGIN;
    }

    // Snap to top edge (magnetic effect)
    if (y < SNAP_THRESHOLD + 60) { // +60 to account for toolbar area
      sy = SNAP_MARGIN + 60;
    }

    return { x: sx, y: sy };
  }, []);

  // Handle drag end with snapping
  const handleDragEnd = useCallback((_: any, info: any) => {
    setIsDragging(false);
    // Calculate new position from current position + drag offset
    const newX = position.x + info.offset.x;
    const newY = position.y + info.offset.y;
    const snapped = calculateSnappedPosition(newX, newY);
    setPosition(snapped);
    onPositionChange?.(snapped);
  }, [calculateSnappedPosition, onPositionChange, position]);

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

  // Shared drag props
  const sharedDragProps = {
    drag: true as const,
    dragControls,
    dragListener: false,
    dragMomentum: false,
    dragElastic: 0,
    dragConstraints: constraintsRef,
    onDragStart: () => setIsDragging(true),
    onDragEnd: handleDragEnd,
  };

  // Square minimized view
  if (squareMinimize && isCollapsed) {
    return (
      <>
        <div ref={constraintsRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: zIndex - 1 }} />
        <motion.div
          {...sharedDragProps}
          initial={{ x: position.x, y: position.y }}
          animate={{ x: position.x, y: position.y }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className={cn(
            "fixed top-0 left-0 cursor-grab active:cursor-grabbing",
            "rounded-xl overflow-hidden",
            "bg-white",
            "border border-gray-200",
            isDragging ? "shadow-md" : "shadow-sm hover:shadow-md",
            "transition-shadow"
          )}
          style={{
            zIndex,
            width: 48,
            height: 48,
            pointerEvents: 'auto',
          }}
          onPointerDown={(e) => {
            dragControls.start(e);
          }}
          onDoubleClick={() => setIsCollapsed(false)}
        >
          <div className="w-full h-full flex items-center justify-center">
            {minimizedIcon || icon}
          </div>
        </motion.div>
      </>
    );
  }

  // Full panel view
  return (
    <>
      {/* Invisible constraints container */}
      <div ref={constraintsRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: zIndex - 1 }} />

      <motion.div
        {...sharedDragProps}
        initial={{ x: position.x, y: position.y }}
        animate={{ x: position.x, y: position.y }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={cn(
          "fixed top-0 left-0 rounded-xl flex flex-col",
          "bg-white",
          "border border-gray-200",
          isDragging ? "shadow-md" : "shadow-sm",
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
            "drag-handle flex items-center justify-between px-4 py-3 shrink-0",
            "bg-white",
            "border-b border-gray-100",
            "cursor-grab active:cursor-grabbing",
            "select-none touch-none",
            "rounded-t-xl"
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
              className="flex-1 flex flex-col min-h-0 overflow-hidden rounded-b-xl"
            >
              <div className="p-4 flex-1 flex flex-col min-h-0 overflow-hidden">
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
