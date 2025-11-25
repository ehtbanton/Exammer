'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setStatus('error');
        setMessage('No verification token provided');
        return;
      }

      try {
        const response = await fetch(`/api/auth/verify-email?token=${token}`);
        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage(data.message);
          setEmail(data.email);

          // Auto-login with the token and redirect to workspace
          if (data.autoLoginToken) {
            const result = await signIn('credentials', {
              email: data.email,
              autoLoginToken: data.autoLoginToken,
              redirect: false,
            });

            if (result?.ok) {
              // Successfully logged in, redirect to workspace
              router.push('/home');
            } else {
              setStatus('error');
              setMessage('Verification successful but auto-login failed. Please sign in manually.');
            }
          }
        } else {
          setStatus('error');
          setMessage(data.error || 'Verification failed');
        }
      } catch (error) {
        setStatus('error');
        setMessage('An error occurred during verification');
      }
    };

    verifyEmail();
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            {status === 'loading' && <Loader2 className="h-6 w-6 animate-spin" />}
            {status === 'success' && <CheckCircle2 className="h-6 w-6 text-green-600" />}
            {status === 'error' && <XCircle className="h-6 w-6 text-red-600" />}
            Email Verification
          </CardTitle>
          <CardDescription>
            {status === 'loading' && 'Verifying your email address...'}
            {status === 'success' && 'Your email has been verified!'}
            {status === 'error' && 'Verification failed'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'loading' && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  {message}
                  {email && (
                    <>
                      <br />
                      <strong>{email}</strong> is now verified.
                    </>
                  )}
                </AlertDescription>
              </Alert>
              <p className="text-sm text-muted-foreground text-center">
                Logging you in and redirecting to workspace...
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertDescription>{message}</AlertDescription>
              </Alert>
              <p className="text-sm text-muted-foreground">
                The verification link may have expired or is invalid.{' '}
                <Link href="/auth/resend-verification" className="font-medium text-primary hover:underline">
                  Request a new verification email
                </Link>.
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          {status === 'success' && (
            <Link href="/home" className="w-full">
              <Button className="w-full">
                Continue to Workspace
              </Button>
            </Link>
          )}
          {status === 'error' && (
            <>
              <Link href="/auth/resend-verification" className="w-full">
                <Button className="w-full">
                  Resend Verification
                </Button>
              </Link>
              <Link href="/auth/signin" className="w-full">
                <Button variant="outline" className="w-full">
                  Back to Sign In
                </Button>
              </Link>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
