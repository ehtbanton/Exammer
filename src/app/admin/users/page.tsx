'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Trash2, KeyRound, UserPlus, Users } from 'lucide-react';

const ACCESS_LEVELS = [
  { value: 0, label: 'Sin acceso', description: 'No puede entrar a la plataforma' },
  { value: 1, label: 'Aprendiz', description: 'Puede estudiar y practicar preguntas' },
  { value: 2, label: 'Instructor', description: 'Puede crear cursos y subir documentos' },
  { value: 3, label: 'Administrador', description: 'Acceso completo al sistema' },
];

interface UserRow {
  id: number;
  email: string;
  name: string | null;
  access_level: number;
  email_verified: number;
  created_at: number;
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Add user form
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newAccessLevel, setNewAccessLevel] = useState(1);
  const [addingUser, setAddingUser] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Reset password
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async () => {
    if (!newEmail || !newPassword) return;
    setAddingUser(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, password: newPassword, name: newName, accessLevel: newAccessLevel }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Error', description: data.error });
        return;
      }

      toast({ title: 'Usuario creado', description: `${newEmail} ahora puede iniciar sesión.` });
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      setNewAccessLevel(1);
      setAddDialogOpen(false);
      fetchUsers();
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo crear el usuario.' });
    } finally {
      setAddingUser(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Error', description: data.error });
        return;
      }

      toast({ title: 'Usuario eliminado' });
      fetchUsers();
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el usuario.' });
    }
  };

  const handleResetPassword = async () => {
    if (!resetUserId || !resetPassword) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: resetUserId, newPassword: resetPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Error', description: data.error });
        return;
      }

      toast({ title: 'Contraseña actualizada' });
      setResetPassword('');
      setResetUserId(null);
      setResetDialogOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cambiar la contraseña.' });
    }
  };

  const handleChangeAccessLevel = async (userId: number, newLevel: number) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, accessLevel: newLevel }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Error', description: data.error });
        return;
      }

      toast({ title: 'Nivel actualizado' });
      fetchUsers();
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cambiar el nivel.' });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Gestión de Usuarios
          </h1>
          <p className="text-muted-foreground mt-1">
            {users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}
          </p>
        </div>

        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Agregar Usuario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar Nuevo Usuario</DialogTitle>
              <DialogDescription>
                El usuario podrá iniciar sesión inmediatamente sin verificación de correo.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="add-name">Nombre (opcional)</Label>
                <Input
                  id="add-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Juan Pérez"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-email">Correo electrónico *</Label>
                <Input
                  id="add-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="usuario@empresa.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-password">Contraseña *</Label>
                <Input
                  id="add-password"
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Contraseña temporal"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Nivel de acceso</Label>
                <Select value={String(newAccessLevel)} onValueChange={(val) => setNewAccessLevel(Number(val))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCESS_LEVELS.filter(l => l.value > 0).map((level) => (
                      <SelectItem key={level.value} value={String(level.value)}>
                        {level.label} — {level.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setAddDialogOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  onClick={handleAddUser}
                  disabled={addingUser || !newEmail || !newPassword}
                  className="flex-1"
                >
                  {addingUser ? 'Creando...' : 'Crear Usuario'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Reset Password Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Contraseña</DialogTitle>
            <DialogDescription>
              Ingresa la nueva contraseña para este usuario.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="reset-password">Nueva Contraseña</Label>
              <Input
                id="reset-password"
                type="text"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Nueva contraseña"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setResetDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleResetPassword} disabled={!resetPassword} className="flex-1">
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-medium">Nombre</th>
                  <th className="text-left p-4 font-medium">Correo</th>
                  <th className="text-left p-4 font-medium">Nivel</th>
                  <th className="text-left p-4 font-medium">Creado</th>
                  <th className="text-right p-4 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-4">{user.name || '—'}</td>
                    <td className="p-4 text-sm">{user.email}</td>
                    <td className="p-4">
                      <Select
                        value={String(user.access_level)}
                        onValueChange={(val) => handleChangeAccessLevel(user.id, Number(val))}
                      >
                        <SelectTrigger className="w-[160px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACCESS_LEVELS.map((level) => (
                            <SelectItem key={level.value} value={String(level.value)}>
                              <div>
                                <span className="font-medium">{level.label}</span>
                                <span className="text-muted-foreground ml-1">— {level.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {new Date(user.created_at * 1000).toLocaleDateString('es-MX')}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          title="Cambiar contraseña"
                          onClick={() => {
                            setResetUserId(user.id);
                            setResetPassword('');
                            setResetDialogOpen(true);
                          }}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" title="Eliminar usuario">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Se eliminará permanentemente a <strong>{user.email}</strong> y todos sus datos. Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteUser(user.id)}>
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
