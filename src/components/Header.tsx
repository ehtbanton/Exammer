"use client";

import Link from 'next/link';
import Image from 'next/image';

export default function Header() {
  return (
    <header className="bg-card border-b sticky top-0 z-10">
      <div className="container mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-3 text-2xl font-bold font-headline text-primary">
            <Image src="/erudate.png" alt="Erudate" width={40} height={40} className="h-10 w-10" />
            <span>Erudate</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
