'use client';

import { useState, useEffect, Suspense } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/workspace';
  const { data: session, status } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showResendLink, setShowResendLink] = useState(false);
  const [loading, setLoading] = useState(false);

  // Redirect if already signed in
  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/workspace');
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setShowResendLink(false);
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        // If email not found, redirect to signup with email pre-filled
        if (result.error === 'EMAIL_NOT_FOUND') {
          router.push(`/auth/signup?email=${encodeURIComponent(email)}`);
          return;
        }
        // If email not verified, show helpful message
        if (result.error === 'EMAIL_NOT_VERIFIED') {
          setError('Tu correo no está verificado. Revisa tu bandeja de entrada o solicita un nuevo correo de verificación.');
          setShowResendLink(true);
          return;
        }
        setError(result.error);
      } else if (result?.ok) {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setError('Ocurrió un error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'github') => {
    setLoading(true);
    try {
      await signIn(provider, { callbackUrl });
    } catch (err) {
      setError('Ocurrió un error al iniciar sesión');
      setLoading(false);
    }
  };

  // Show loading while checking auth status
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render the form if already authenticated (will redirect)
  if (status === 'authenticated') {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Iniciar Sesión</CardTitle>
          <CardDescription>Ingresa tus credenciales para acceder a tu cuenta</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </Button>
          </form>

          {(process.env.NEXT_PUBLIC_GOOGLE_ENABLED || process.env.NEXT_PUBLIC_GITHUB_ENABLED) && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">O continuar con</span>
                </div>
              </div>

              <div className="grid gap-2">
                {process.env.NEXT_PUBLIC_GOOGLE_ENABLED && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOAuthSignIn('google')}
                    disabled={loading}
                  >
                    Iniciar con Google
                  </Button>
                )}
                {process.env.NEXT_PUBLIC_GITHUB_ENABLED && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOAuthSignIn('github')}
                    disabled={loading}
                  >
                    Iniciar con GitHub
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            Contacta a tu administrador si necesitas una cuenta o restablecer tu contraseña.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Cargando...</div>}>
      <SignInContent />
    </Suspense>
  );
}
