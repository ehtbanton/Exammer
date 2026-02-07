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
        "flex items-start gap-3 p-3.5 rounded-2xl text-left",
        "bg-[var(--s-card)] backdrop-blur-sm",
        "[box-shadow:var(--s-shadow-sm)]",
        "transition-all duration-200 ease-out",
        disabled
          ? "opacity-40 cursor-not-allowed"
          : "hover:bg-[var(--s-card-hover)] hover:[box-shadow:var(--s-shadow-md)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
          iconBgColor
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-medium text-[13px] text-[var(--s-text)] leading-tight">{title}</p>
        <p className="text-[11px] text-[var(--s-text-muted)] mt-0.5 leading-snug">{description}</p>
      </div>
    </button>
  );
}
