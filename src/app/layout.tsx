import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/app/context/AppContext';
import { SessionProvider } from '@/components/SessionProvider';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CookieConsent from '@/components/CookieConsent';
import { BackgroundTaskIndicator } from '@/components/BackgroundTaskIndicator';
import { ThemeProvider } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  metadataBase: new URL('https://exammer.co.uk'),
  title: 'Exammer',
  description: 'AI-Powered Exam Preparation Tool',
  icons: {
    icon: '/exammer.png',
  },
  openGraph: {
    title: 'Exammer - Get hooked on Revision',
    description: 'AI framework that turns past papers into a structured revision plan, using an interactive tutor and gamified progress tracking.',
    url: 'https://exammer.co.uk',
    siteName: 'Exammer',
    images: [
      {
        url: '/exammer.png',
        width: 800,
        height: 800,
        alt: 'Exammer Logo',
      },
    ],
    locale: 'en_GB',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Exammer - Get hooked on Revision',
    description: 'AI framework that turns past papers into a structured revision plan.',
    images: ['/exammer.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="icon" href="/exammer.png" type="image/png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&family=Source+Code+Pro:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className={cn('font-body antialiased h-full')}>
        <ThemeProvider>
          <SessionProvider>
            <AppProvider>
              <div className="flex flex-col h-full">
                <Header />
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
                  {children}
                </main>
                <Footer />
              </div>
              <BackgroundTaskIndicator />
              <CookieConsent />
              <Toaster />
            </AppProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
