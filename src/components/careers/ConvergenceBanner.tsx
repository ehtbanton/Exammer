"use client";

import { useState } from 'react';
import { Sparkles, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConvergenceBannerProps {
  depth: number;
  onConverge: () => void;
  onDismiss: () => void;
}

export function ConvergenceBanner({ depth, onConverge, onDismiss }: ConvergenceBannerProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "bg-gradient-to-r from-amber-500 to-orange-500",
        "rounded-2xl shadow-2xl",
        "transform transition-all duration-500 ease-out",
        "animate-in slide-in-from-bottom-10 fade-in"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative px-6 py-4 flex items-center gap-4">
        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className="absolute -top-2 -right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
        >
          <X className="h-4 w-4 text-gray-600" />
        </button>

        {/* Icon */}
        <div className={cn(
          "h-12 w-12 rounded-full bg-white/20 flex items-center justify-center",
          "transition-transform duration-300",
          isHovered && "scale-110"
        )}>
          <Sparkles className="h-6 w-6 text-white" />
        </div>

        {/* Content */}
        <div className="flex flex-col">
          <span className="text-white font-bold text-lg">
            Ready for recommendations?
          </span>
          <span className="text-white/80 text-sm">
            You've explored {depth} levels deep. Get personalized university suggestions!
          </span>
        </div>

        {/* Action button */}
        <Button
          onClick={onConverge}
          className={cn(
            "ml-4 bg-white text-amber-600 hover:bg-amber-50",
            "font-semibold px-6",
            "transition-all duration-300",
            isHovered && "scale-105"
          )}
        >
          <span>Show My Path</span>
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {/* Animated glow effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 opacity-0 animate-pulse -z-10 blur-xl" />
    </div>
  );
}
