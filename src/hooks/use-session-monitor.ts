import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

/**
 * Monitor session validity using Server-Sent Events
 * Receives real-time notifications when session is invalidated
 * Includes retry logic with exponential backoff
 */
export function useSessionMonitor() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !session) {
      return;
    }

    const connectSSE = () => {
      // Prevent duplicate connections
      if (eventSourceRef.current) {
        return;
      }

      // Connect to SSE endpoint for real-time session events
      const eventSource = new EventSource('/api/auth/session-events');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        // Reset retry count on successful connection
        retryCountRef.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'connected') {
            console.log('Connected to session events');
          } else if (data.type === 'session_invalidated') {
            console.log('Session invalidated, refreshing page to reflect changes');
            eventSource.close();
            eventSourceRef.current = null;
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
        eventSourceRef.current = null;

        // Retry with exponential backoff if under max attempts
        if (retryCountRef.current < MAX_RETRY_ATTEMPTS) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCountRef.current);
          retryCountRef.current++;

          console.log(`Retrying SSE connection (attempt ${retryCountRef.current}/${MAX_RETRY_ATTEMPTS}) in ${delay}ms`);

          retryTimeoutRef.current = setTimeout(() => {
            connectSSE();
          }, delay);
        } else {
          console.error('SSE connection failed after maximum retry attempts');
        }
      };
    };

    // Initial connection
    connectSSE();

    return () => {
      // Cleanup
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      retryCountRef.current = 0;
    };
  }, [status, session, router]);
}
