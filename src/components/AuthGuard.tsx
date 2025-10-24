'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import PageSpinner from '@/components/PageSpinner';
import { AccessDeniedPage } from '@/components/AccessDeniedPage';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [accessLevel, setAccessLevel] = useState<number | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Fetch access level when authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      const fetchAccessLevel = async () => {
        try {
          const response = await fetch('/api/auth/access-level');
          if (response.ok) {
            const data = await response.json();
            setAccessLevel(data.accessLevel);
          } else {
            // If endpoint fails, default to no access for safety
            setAccessLevel(0);
          }
        } catch (error) {
          console.error('Error fetching access level:', error);
          setAccessLevel(0);
        } finally {
          setIsCheckingAccess(false);
        }
      };

      fetchAccessLevel();
    }
  }, [status]);

  // Show loading spinner while checking authentication or access level
  if (status === 'loading' || (status === 'authenticated' && isCheckingAccess)) {
    return <PageSpinner />;
  }

  // Show loading spinner while redirecting
  if (status === 'unauthenticated') {
    return <PageSpinner />;
  }

  // Show access denied page for level 0 users
  if (accessLevel === 0) {
    return <AccessDeniedPage />;
  }

  // User is authenticated and has access, show the page
  return <>{children}</>;
}
