"use client";

import React, { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SnippingToolProps {
  isActive: boolean;
  onSelectionComplete: (bounds: { x: number; y: number; width: number; height: number }) => void;
  onCancel: () => void;
}

export function SnippingTool({ isActive, onSelectionComplete, onCancel }: SnippingToolProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isActive) return;

    setIsDrawing(true);
    const rect = overlayRef.current?.getBoundingClientRect();
    const x = e.clientX - (rect?.left || 0);
    const y = e.clientY - (rect?.top || 0);
    setStartPos({ x, y });
    setCurrentPos({ x, y });
  }, [isActive]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawing || !isActive) return;

    const rect = overlayRef.current?.getBoundingClientRect();
    const x = e.clientX - (rect?.left || 0);
    const y = e.clientY - (rect?.top || 0);
    setCurrentPos({ x, y });
  }, [isDrawing, isActive]);

  const handlePointerUp = useCallback(() => {
    if (!isDrawing || !isActive) return;

    setIsDrawing(false);

    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const width = Math.abs(currentPos.x - startPos.x);
    const height = Math.abs(currentPos.y - startPos.y);

    // Only complete if selection is meaningful (at least 10x10)
    if (width > 10 && height > 10) {
      onSelectionComplete({ x, y, width, height });
    }

    // Reset positions
    setStartPos({ x: 0, y: 0 });
    setCurrentPos({ x: 0, y: 0 });
  }, [isDrawing, isActive, startPos, currentPos, onSelectionComplete]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  }, [onCancel]);

  if (!isActive) return null;

  // Calculate selection rectangle
  const selectionRect = {
    left: Math.min(startPos.x, currentPos.x),
    top: Math.min(startPos.y, currentPos.y),
    width: Math.abs(currentPos.x - startPos.x),
    height: Math.abs(currentPos.y - startPos.y),
  };

  return (
    <motion.div
      ref={overlayRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] cursor-crosshair"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{ touchAction: 'none' }}
    >
      {/* Semi-transparent overlay */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Instructions */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-lg text-sm">
        Drag to select area • Press <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">Esc</kbd> to cancel
      </div>

      {/* Selection Rectangle */}
      {isDrawing && selectionRect.width > 0 && selectionRect.height > 0 && (
        <div
          className={cn(
            "absolute border-2 border-blue-500 bg-blue-500/10",
            "pointer-events-none"
          )}
          style={{
            left: selectionRect.left,
            top: selectionRect.top,
            width: selectionRect.width,
            height: selectionRect.height,
          }}
        >
          {/* Size indicator */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
            {Math.round(selectionRect.width)} × {Math.round(selectionRect.height)}
          </div>
        </div>
      )}
    </motion.div>
  );
}
