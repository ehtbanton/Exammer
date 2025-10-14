"use client";

import Link from 'next/link';
import { GraduationCap } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-card border-b sticky top-0 z-10">
      <div className="container mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold font-headline text-primary">
            <GraduationCap className="h-7 w-7" />
            <span>Examplify AI</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
