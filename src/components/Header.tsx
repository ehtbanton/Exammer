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
import { LogOut, User, Terminal, ArrowLeft, Users, Home, Target } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import FeedbackButton from './FeedbackButton';
import DonationButton from './DonationButton';

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

  const isAdminPage = pathname?.startsWith('/admin');
  const isWorkspacePage = pathname?.startsWith('/workspace');
  const isClassesPage = pathname?.startsWith('/classes');

  return (
    <header className="bg-card border-b sticky top-0 z-10">
      <div className="container mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex items-center h-16">
          {/* LEFT: Logo */}
          <div className="flex items-center gap-3">
            <Link href="/home" className="flex items-center gap-3 text-2xl font-bold font-headline text-primary">
              <Image src="/exammer.png" alt="Exammer" width={40} height={40} className="h-10 w-10" />
              <span>Exammer</span>
            </Link>
          </div>

          {/* MIDDLE: Navigation buttons */}
          <div className="flex-1 flex justify-center items-center gap-3">
            {status === 'authenticated' && (
              <>
                {/* Workspace and Classes buttons for students, teachers, and admins (level 1-3) */}
                {accessLevel !== null && accessLevel >= 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className={isWorkspacePage ? "shadow-[0_0_0_2px_rgb(55,65,81)] dark:shadow-[0_0_0_2px_white]" : ""}
                    >
                      <Link href="/workspace">
                        <Home className="h-4 w-4 mr-2" />
                        Workspace
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className={isClassesPage ? "shadow-[0_0_0_2px_rgb(55,65,81)] dark:shadow-[0_0_0_2px_white]" : ""}
                    >
                      <Link href={accessLevel === 1 ? "/classes/join" : "/classes"}>
                        <Users className="h-4 w-4 mr-2" />
                        Classes
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className={pathname?.startsWith('/workspace/careers') ? "shadow-[0_0_0_2px_rgb(55,65,81)] dark:shadow-[0_0_0_2px_white]" : ""}
                    >
                      <Link href="/workspace/careers">
                        <Target className="h-4 w-4 mr-2" />
                        Careers
                      </Link>
                    </Button>
                  </>
                )}

                {/* Admin button for level 3 users */}
                {accessLevel === 3 && (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className={isAdminPage ? "shadow-[0_0_0_2px_rgb(55,65,81)] dark:shadow-[0_0_0_2px_white]" : ""}
                  >
                    <Link href="/admin">
                      <Terminal className="h-4 w-4 mr-2" />
                      Admin
                    </Link>
                  </Button>
                )}
              </>
            )}
          </div>

          {/* RIGHT: Feedback, user avatar, and theme toggle */}
          <div className="flex items-center gap-4">
            {status === 'loading' ? (
              <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />
            ) : session ? (
              <>
                {/* Feedback button */}
                <FeedbackButton
                  variant="default"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white shadow-md"
                />

                {/* Donation button */}
                <DonationButton
                  variant="default"
                  size="sm"
                  className="bg-gray-500 hover:bg-gray-600 text-white shadow-md"
                />

                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10 bg-black dark:bg-white">
                      <AvatarImage src={session.user?.image || undefined} alt={session.user?.name || 'User'} />
                      <AvatarFallback className="bg-black dark:bg-white text-white dark:text-black font-semibold">{getUserInitials(session.user?.name, session.user?.email)}</AvatarFallback>
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
                  <DropdownMenuItem asChild>
                    <Link href={`/profile/${session.user?.id}`}>
                      <User className="mr-2 h-4 w-4" />
                      <span>My Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/auth/signin' })} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

                <ThemeToggle />
              </>
            ) : (
              <Button variant="ghost" asChild>
                <Link href="/auth/signin">Login</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
