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
            "rounded-2xl overflow-hidden",
            "bg-[var(--s-surface)] backdrop-blur-xl",
            "[box-shadow:var(--s-shadow-sm)]",
            isDragging && "[box-shadow:var(--s-shadow-lg)]",
            "transition-shadow duration-200"
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
          "fixed top-0 left-0 rounded-2xl flex flex-col",
          "bg-[var(--s-surface)] backdrop-blur-xl",
          "[box-shadow:var(--s-shadow-lg)]",
          isDragging && "[box-shadow:var(--s-shadow-lg)]",
          "transition-shadow duration-200",
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
            "cursor-grab active:cursor-grabbing",
            "select-none touch-none",
            "rounded-t-2xl"
          )}
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="h-4 w-4 text-[var(--s-text-muted)]" />
            <span className="text-[var(--s-text-muted)]">{icon}</span>
            <h3 className="font-semibold text-[13px] text-[var(--s-text)]">
              {title}
            </h3>
          </div>

          <div className="flex items-center gap-1">
            {collapsible && (
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--s-text-muted)] hover:bg-[var(--s-hover)] transition-colors active:scale-95"
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
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--s-text-muted)] hover:bg-[var(--s-danger-hover-bg)] hover:text-[var(--s-danger)] transition-colors active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="mx-3">
          <div className="h-px bg-gradient-to-r from-transparent via-[var(--s-divider)] to-transparent" />
        </div>

        {/* Content */}
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              variants={collapseVariants}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              className="flex-1 flex flex-col min-h-0 overflow-hidden rounded-b-2xl"
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
              "absolute bottom-0 right-0 w-5 h-5 cursor-se-resize",
              "flex items-center justify-center",
              "rounded-tl-lg opacity-0 hover:opacity-100 transition-opacity",
              isResizing && "opacity-100"
            )}
            style={{ touchAction: 'none' }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              className="text-[var(--s-text-muted)]"
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
