"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User, Terminal, ArrowLeft, Users, Home } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';

export default function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [accessLevel, setAccessLevel] = useState<number | null>(null);

  // Fetch access level when authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      const fetchAccessLevel = async () => {
        try {
          const response = await fetch('/api/auth/access-level');
          if (response.ok) {
            const data = await response.json();
            setAccessLevel(data.accessLevel);
          }
        } catch (error) {
          console.error('Error fetching access level:', error);
        }
      };

      fetchAccessLevel();
    }
  }, [status]);

  const getUserInitials = (name?: string | null, email?: string | null) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return 'U';
  };

  const isDebugPage = pathname === '/t';
  const isClassesPage = pathname.startsWith('/classes');

  return (
    <header className="bg-card border-b sticky top-0 z-10">
      <div className="container mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3 text-2xl font-bold font-headline text-primary">
              <Image src="/exammer.png" alt="Exammer" width={40} height={40} className="h-10 w-10" />
              <span>Exammer</span>
            </Link>

            {/* Debug/Back button for level 3 users - moved to left */}
            {status === 'authenticated' && accessLevel === 3 && (
              isDebugPage ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Link>
                </Button>
              ) : (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/t">
                    <Terminal className="h-4 w-4 mr-2" />
                    Logs
                  </Link>
                </Button>
              )
            )}
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            {status === 'loading' ? (
              <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />
            ) : session ? (
              <>
                {/* Classes/Workspace button for students, teachers, and admins (level 1-3) */}
                {accessLevel !== null && accessLevel >= 1 && (
                  isClassesPage ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/workspace">
                        <Home className="h-4 w-4 mr-2" />
                        Workspace
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={accessLevel === 1 ? "/workspace/classes/join" : "/workspace/classes"}>
                        <Users className="h-4 w-4 mr-2" />
                        Classes
                      </Link>
                    </Button>
                  )
                )}

                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={session.user?.image || undefined} alt={session.user?.name || 'User'} />
                      <AvatarFallback>{getUserInitials(session.user?.name, session.user?.email)}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{session.user?.name || 'User'}</p>
                      <p className="text-xs leading-none text-muted-foreground">{session.user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/auth/signin' })} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" asChild>
                  <Link href="/auth/signin">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link href="/auth/signup">Sign Up</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
