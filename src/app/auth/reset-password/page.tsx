'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Restablecer Contraseña</CardTitle>
          <CardDescription>Función de restablecimiento de contraseña</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              La función de restablecimiento de contraseña estará disponible pronto. Contacta a soporte si necesitas restablecer tu contraseña.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Link href="/auth/signin" className="text-sm text-muted-foreground hover:underline">
            Volver a iniciar sesión
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
