"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * Landing page shown to users with access level 0 (no access)
 * Polls for access level changes and auto-redirects when granted access
 */
export function AccessDeniedPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [checkCount, setCheckCount] = useState(0);

  const checkAccessLevel = async () => {
    if (isChecking) return;

    setIsChecking(true);
    try {
      // Add cache-busting parameter
      const response = await fetch(`/api/auth/access-level?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLastChecked(new Date());
        setCheckCount(prev => prev + 1);

        console.log('Access level check:', data.accessLevel, 'at', new Date().toISOString());

        if (data.accessLevel >= 1) {
          // Access granted! Redirect to home
          console.log('Access granted! Redirecting...');
          router.push('/');
          router.refresh();
        }
      }
    } catch (error) {
      console.error('Error checking access level:', error);
      setLastChecked(new Date());
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Check immediately on mount
    checkAccessLevel();

    // Then poll every 3 seconds
    const interval = setInterval(checkAccessLevel, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleManualCheck = () => {
    checkAccessLevel();
  };

  return (
    <div className="container mx-auto flex items-center justify-center min-h-[80vh]">
      <Card className="max-w-2xl w-full text-center py-12 px-8">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <AlertCircle className="h-16 w-16 text-amber-500" />
          </div>
          <CardTitle className="text-3xl font-bold font-headline">
            Access Required
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-lg text-muted-foreground">
            This tool is currently a demo. To try it out, please get in touch with Anton May.
          </p>
          <div className="bg-muted rounded-lg p-6 space-y-2">
            <p className="text-sm font-medium">Contact Information</p>
            <p className="text-sm text-muted-foreground">
              Email: <a href="mailto:anton.may@new.ox.ac.uk" className="text-primary hover:underline">
                anton.may@new.ox.ac.uk
              </a>
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button
              onClick={handleManualCheck}
              disabled={isChecking}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
              Check Access Now
            </Button>
            <p className="text-xs text-muted-foreground">
              {lastChecked && (
                <>
                  Last checked: {lastChecked.toLocaleTimeString()} (Check #{checkCount})
                </>
              )}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Once access is granted, this page will automatically refresh and you'll be able to use the application.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
