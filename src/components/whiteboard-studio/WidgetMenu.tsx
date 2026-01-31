"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Youtube, Music, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type WidgetType = 'youtube' | 'spotify' | 'flashcards';

interface WidgetMenuProps {
  onAddWidget: (type: WidgetType) => void;
  activeWidgets: WidgetType[];
}

const widgets = [
  { type: 'youtube' as WidgetType, icon: Youtube, label: 'YouTube', color: 'text-red-500' },
  { type: 'spotify' as WidgetType, icon: Music, label: 'Spotify', color: 'text-green-500' },
  { type: 'flashcards' as WidgetType, icon: Layers, label: 'Flashcards', color: 'text-purple-500' },
];

export function WidgetMenu({ onAddWidget, activeWidgets }: WidgetMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100",
          isOpen && "bg-gray-100 dark:bg-gray-800"
        )}
      >
        <Plus className="h-4 w-4 mr-1" />
        Widgets
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-[130]"
              onClick={() => setIsOpen(false)}
            />

            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className={cn(
                "absolute bottom-full left-0 mb-2 z-[140]",
                "bg-white dark:bg-gray-900 rounded-xl shadow-xl",
                "border border-gray-200 dark:border-gray-700",
                "p-2 min-w-[160px]"
              )}
            >
              <div className="space-y-1">
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
                        "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
                        "transition-colors",
                        isActive
                          ? "opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800"
                          : "hover:bg-gray-100 dark:hover:bg-gray-800"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", color)} />
                      <span>{label}</span>
                      {isActive && (
                        <span className="ml-auto text-xs text-gray-400">Open</span>
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
