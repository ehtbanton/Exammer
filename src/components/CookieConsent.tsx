'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X } from 'lucide-react';
import { CookiePreferencesDialog } from '@/components/CookiePreferencesDialog';
import {
  hasConsented,
  acceptAllCookies,
  acceptEssentialOnly,
} from '@/lib/cookie-consent';

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  useEffect(() => {
    // Check if user has already consented
    if (!hasConsented()) {
      setIsVisible(true);
    }

    // Listen for manual trigger from footer
    const handleShowBanner = () => {
      setShowPreferences(true);
    };

    window.addEventListener('show-cookie-banner', handleShowBanner);
    return () => window.removeEventListener('show-cookie-banner', handleShowBanner);
  }, []);

  const handleAcceptAll = () => {
    acceptAllCookies();
    setIsVisible(false);
  };

  const handleEssentialOnly = () => {
    acceptEssentialOnly();
    setIsVisible(false);
  };

  const handleManagePreferences = () => {
    setShowPreferences(true);
  };

  const handlePreferencesClose = () => {
    setShowPreferences(false);
    // If they saved preferences through the dialog, hide the banner
    if (hasConsented()) {
      setIsVisible(false);
    }
  };

  if (!isVisible) {
    return (
      <CookiePreferencesDialog
        open={showPreferences}
        onOpenChange={handlePreferencesClose}
      />
    );
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom-5">
        <Card className="max-w-4xl mx-auto p-6 shadow-lg border-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Usamos cookies</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Usamos cookies esenciales para mantener tu sesión y que el servicio funcione.
                También nos gustaría usar cookies opcionales para recordar tus preferencias y entender cómo usas nuestro sitio.
                Para más información, consulta nuestra{' '}
                <Link href="/privacy" className="text-primary hover:underline">
                  Política de Privacidad
                </Link>.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleAcceptAll} size="sm">
                  Aceptar Todo
                </Button>
                <Button onClick={handleEssentialOnly} variant="outline" size="sm">
                  Solo Esenciales
                </Button>
                <Button onClick={handleManagePreferences} variant="ghost" size="sm">
                  Administrar Preferencias
                </Button>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={handleEssentialOnly}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>

      <CookiePreferencesDialog
        open={showPreferences}
        onOpenChange={handlePreferencesClose}
      />
    </>
  );
}
