"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface ActionCardProps {
  icon: React.ReactNode;
  iconBgColor: string;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}

export function ActionCard({
  icon,
  iconBgColor,
  title,
  description,
  onClick,
  disabled = false,
}: ActionCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-start gap-3 p-3 rounded-xl text-left",
        "bg-white border border-gray-200",
        "transition-colors",
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:bg-gray-50 cursor-pointer"
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
          iconBgColor
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-medium text-sm text-gray-900 leading-tight">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-snug">{description}</p>
      </div>
    </button>
  );
}
