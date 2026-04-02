'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ResendVerificationPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Ocurrió un error');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch (err) {
      setError('Ocurrió un error inesperado');
      setLoading(false);
    }
  };

  // Show success message after sending email
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Revisa tu Correo</CardTitle>
            <CardDescription>Correo de verificación enviado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                Si existe una cuenta con el correo <strong>{email}</strong> sin verificar,
                se ha enviado un correo de verificación. Revisa tu bandeja de entrada.
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground">
              ¿No lo recibiste? Revisa tu carpeta de spam o espera 60 segundos antes de solicitar otro correo.
            </p>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Link href="/auth/signin" className="w-full">
              <Button variant="outline" className="w-full">
                Volver a Iniciar Sesión
              </Button>
            </Link>
            <Button
              className="w-full"
              onClick={() => {
                setSuccess(false);
                setEmail('');
              }}
            >
              Enviar Otro
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Reenviar Correo de Verificación</CardTitle>
          <CardDescription>Ingresa tu correo para recibir un nuevo enlace de verificación</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
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

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar Correo de Verificación'}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <div className="text-sm text-muted-foreground">
            ¿Recuerdas tu contraseña?{' '}
            <Link href="/auth/signin" className="font-medium text-primary hover:underline">
              Iniciar sesión
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
