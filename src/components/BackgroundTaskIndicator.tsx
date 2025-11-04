"use client";

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { backgroundQueue, type BackgroundTask } from '@/lib/background-queue';

export function BackgroundTaskIndicator() {
  const [currentTask, setCurrentTask] = useState<BackgroundTask | null>(null);

  useEffect(() => {
    const unsubscribe = backgroundQueue.subscribe((state) => {
      setCurrentTask(state.currentTask);
    });

    return unsubscribe;
  }, []);

  if (!currentTask || currentTask.status !== 'running') {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm font-medium">{currentTask.displayName}</span>
    </div>
  );
}
