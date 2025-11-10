import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <Link href="/home" className="flex flex-col items-center gap-6 cursor-pointer hover:opacity-80 transition-opacity">
        <Image
          src="/exammer.png"
          alt="Exammer Logo"
          width={200}
          height={200}
          className="h-50 w-50"
        />

        <div className="flex flex-col items-center gap-2">
          <h1 className="text-5xl font-bold font-headline text-primary">
            Exammer
          </h1>
          <p className="text-xl text-muted-foreground">
            Get hooked on Revision
          </p>
        </div>
      </Link>
    </div>
  );
}
