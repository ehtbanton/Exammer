import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/app/context/AppContext';
import { SessionProvider } from '@/components/SessionProvider';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/Header';
import CookieConsent from '@/components/CookieConsent';
import { BackgroundTaskIndicator } from '@/components/BackgroundTaskIndicator';
import { ThemeProvider } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  metadataBase: new URL('https://exammer.co.uk'),
  title: 'Exammer',
  description: 'Plataforma de Aprendizaje con IA',
  icons: {
    icon: '/exammer.png',
  },
  openGraph: {
    title: 'Exammer - Aprende con inteligencia',
    description: 'Plataforma de IA que convierte tus documentos en un plan de aprendizaje estructurado, con un tutor interactivo y seguimiento gamificado.',
    url: 'https://exammer.co.uk',
    siteName: 'Exammer',
    images: [
      {
        url: '/exammer.png',
        width: 800,
        height: 800,
        alt: 'Logo de Exammer',
      },
    ],
    locale: 'es_MX',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Exammer - Aprende con inteligencia',
    description: 'Plataforma de IA que convierte tus documentos en un plan de aprendizaje estructurado.',
    images: ['/exammer.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <head>
        <link rel="icon" href="/exammer.png" type="image/png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700&family=Source+Code+Pro:wght@400;700&display=swap" rel="stylesheet" />
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
