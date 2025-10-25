import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

/**
 * Monitor session validity and redirect if session is invalidated
 * This hook checks the session every 5 seconds
 */
export function useSessionMonitor() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    // Check session validity every 5 seconds
    const interval = setInterval(async () => {
      try {
        // Force session update to check if it's still valid
        const updatedSession = await update();

        // If session is no longer valid, redirect to signin
        if (!updatedSession) {
          console.log('Session invalidated, redirecting to signin');
          router.push('/auth/signin');
          router.refresh();
        }
      } catch (error) {
        console.error('Error checking session:', error);
        // If there's an error, the session might be invalid
        router.push('/auth/signin');
        router.refresh();
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [status, update, router]);
}
