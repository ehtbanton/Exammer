'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import PageSpinner from '@/components/PageSpinner';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [accessLevel, setAccessLevel] = useState<number | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);

  // Check authentication
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Check access level
  useEffect(() => {
    if (status === 'authenticated') {
      const fetchAccessLevel = async () => {
        try {
          const response = await fetch('/api/auth/access-level');
          if (response.ok) {
            const data = await response.json();
            setAccessLevel(data.accessLevel);

            // Redirect if not admin (access level 3)
            if (data.accessLevel !== 3) {
              router.push('/');
            }
          } else {
            setAccessLevel(0);
            router.push('/');
          }
        } catch (error) {
          console.error('Error fetching access level:', error);
          setAccessLevel(0);
          router.push('/');
        } finally {
          setIsCheckingAccess(false);
        }
      };

      fetchAccessLevel();
    }
  }, [status, router]);

  if (status === 'loading' || isCheckingAccess) {
    return <PageSpinner />;
  }

  if (accessLevel !== 3) {
    return <PageSpinner />;
  }

  return <>{children}</>;
}
