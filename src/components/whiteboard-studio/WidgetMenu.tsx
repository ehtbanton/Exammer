"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Youtube, Music, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

export type WidgetType = 'youtube' | 'spotify' | 'flashcards';

interface WidgetMenuProps {
  onAddWidget: (type: WidgetType) => void;
  activeWidgets: WidgetType[];
}

const widgets = [
  { type: 'youtube' as WidgetType, icon: Youtube, label: 'YouTube', color: 'text-[#ff3b30]' },
  { type: 'spotify' as WidgetType, icon: Music, label: 'Spotify', color: 'text-[#1DB954]' },
  { type: 'flashcards' as WidgetType, icon: Layers, label: 'Flashcards', color: 'text-[var(--s-text-muted)]' },
];

export function WidgetMenu({ onAddWidget, activeWidgets }: WidgetMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      {/* Frosted glass pill trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-5 py-2.5",
          "rounded-xl text-[13px] font-medium",
          "bg-[var(--s-card)] backdrop-blur-xl",
          "[box-shadow:var(--s-shadow-md)]",
          "hover:bg-[var(--s-card-hover)] hover:[box-shadow:var(--s-shadow-lg)]",
          "hover:-translate-y-px",
          "text-[var(--s-text-secondary)]",
          "transition-all duration-200",
          "active:scale-[0.98]",
          isOpen && "bg-[var(--s-card-hover)] [box-shadow:var(--s-shadow-lg)]"
        )}
      >
        <Plus className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-45")} />
        Widgets
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-[130]"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown opens upward */}
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className={cn(
                "absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-[140]",
                "bg-[var(--s-card)] backdrop-blur-xl rounded-2xl",
                "[box-shadow:var(--s-shadow-lg)]",
                "p-1.5 min-w-[180px]"
              )}
            >
              <div className="space-y-0.5">
                {widgets.map(({ type, icon: Icon, label, color }) => {
                  const isActive = activeWidgets.includes(type);
                  return (
                    <button
                      key={type}
                      onClick={() => {
                        onAddWidget(type);
                        setIsOpen(false);
                      }}
                      disabled={isActive}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px]",
                        "transition-all duration-150",
                        isActive
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-[var(--s-hover)] active:scale-[0.98]"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", color)} />
                      <span className="text-[var(--s-text)] font-medium">{label}</span>
                      {isActive && (
                        <span className="ml-auto text-[11px] text-[var(--s-text-muted)]">Open</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
