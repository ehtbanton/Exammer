'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Terminal, Users } from 'lucide-react';

export default function AdminPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Panel de Administración</h1>
        <p className="text-muted-foreground">
          Gestiona y monitorea tu aplicación Exammer
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* User Management */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuarios
            </CardTitle>
            <CardDescription>
              Agregar, eliminar y gestionar cuentas de usuarios
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin/users">
                Gestionar Usuarios
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Server Logs */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Registros del Servidor
            </CardTitle>
            <CardDescription>
              Ver registros del servidor en tiempo real
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin/logs">
                Ver Registros
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
