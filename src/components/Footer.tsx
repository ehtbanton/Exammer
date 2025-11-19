'use client';

import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-background mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Company Info */}
          <div>
            <h3 className="font-semibold mb-3">Exammer</h3>
            <p className="text-sm text-muted-foreground mb-2">
              AI-powered exam preparation tool
            </p>
            <p className="text-xs text-muted-foreground">
              New College<br />
              Oxford, OX1 3BN<br />
              United Kingdom
            </p>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="font-semibold mb-3">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/privacy" className="text-muted-foreground hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-muted-foreground hover:text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('show-cookie-banner'))}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Cookie Preferences
                </button>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold mb-3">Contact</h3>
            <p className="text-sm text-muted-foreground">
              <a
                href="mailto:anton.may@new.ox.ac.uk"
                className="hover:text-primary transition-colors"
              >
                anton.may@new.ox.ac.uk
              </a>
            </p>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="text-center text-sm text-muted-foreground">
          © {currentYear} Exammer. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
