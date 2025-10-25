'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';
import { useSessionMonitor } from '@/hooks/use-session-monitor';

function SessionMonitor() {
  useSessionMonitor();
  return null;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <SessionMonitor />
      {children}
    </NextAuthSessionProvider>
  );
}
