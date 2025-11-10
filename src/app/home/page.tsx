import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-8">
        <Image
          src="/exammer.png"
          alt="Exammer Logo"
          width={120}
          height={120}
          className="h-30 w-30"
        />

        <Link href="/auth/signin">
          <Button size="lg">
            Login
          </Button>
        </Link>
      </div>
    </div>
  );
}
