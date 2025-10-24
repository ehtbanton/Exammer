'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail } from 'lucide-react';

export default function VerifyRequestPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            Check Your Email
          </CardTitle>
          <CardDescription>Verification email sent</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              We've sent you a verification email. Please check your inbox and click the link to verify your account.
              The link will expire in 24 hours.
            </AlertDescription>
          </Alert>
          <div className="mt-4 text-sm text-muted-foreground">
            <p>Didn't receive the email?</p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>Check your spam folder</li>
              <li>Make sure you entered the correct email address</li>
              <li>Wait a few minutes and check again</li>
            </ul>
          </div>
        </CardContent>
        <CardFooter>
          <Link href="/auth/signin" className="text-sm text-muted-foreground hover:underline">
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
