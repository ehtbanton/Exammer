'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
          <CardDescription>Password reset functionality</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Password reset functionality is coming soon. Please contact support if you need to reset your password.
            </AlertDescription>
          </Alert>
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
