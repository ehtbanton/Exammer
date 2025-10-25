import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

/**
 * Monitor session validity using Server-Sent Events
 * Receives real-time notifications when session is invalidated
 */
export function useSessionMonitor() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    // Connect to SSE endpoint for real-time session events
    const eventSource = new EventSource('/api/auth/session-events');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
          console.log('Connected to session events');
        } else if (data.type === 'session_invalidated') {
          console.log('Session invalidated, refreshing page to reflect changes');
          eventSource.close();
          // Force a full page refresh to update session state
          window.location.reload();
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [status, router]);
}
