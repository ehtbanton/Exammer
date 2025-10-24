'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import PageSpinner from '@/components/PageSpinner';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Show loading spinner while checking authentication
  if (status === 'loading') {
    return <PageSpinner />;
  }

  // Show loading spinner while redirecting
  if (status === 'unauthenticated') {
    return <PageSpinner />;
  }

  // User is authenticated, show the page
  return <>{children}</>;
}
