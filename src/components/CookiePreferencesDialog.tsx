'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  CookiePreferences,
  COOKIES,
  DEFAULT_PREFERENCES,
  getCookiePreferences,
  setCookiePreferences,
  acceptAllCookies,
} from '@/lib/cookie-consent';

interface CookiePreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CookiePreferencesDialog({ open, onOpenChange }: CookiePreferencesDialogProps) {
  const [preferences, setPreferences] = useState<CookiePreferences>(() => {
    return getCookiePreferences() || DEFAULT_PREFERENCES;
  });

  const handleSave = () => {
    setCookiePreferences(preferences);
    onOpenChange(false);
  };

  const handleAcceptAll = () => {
    acceptAllCookies();
    onOpenChange(false);
  };

  const essentialCookies = COOKIES.filter(c => c.category === 'essential');
  const functionalCookies = COOKIES.filter(c => c.category === 'functional');
  const analyticsCookies = COOKIES.filter(c => c.category === 'analytics');
  const marketingCookies = COOKIES.filter(c => c.category === 'marketing');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preferencias de Cookies</DialogTitle>
          <DialogDescription>
            Administra qué cookies deseas permitir. Las cookies esenciales son necesarias para que el sitio funcione y no se pueden desactivar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Essential Cookies */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-semibold">Cookies Esenciales</Label>
                <p className="text-sm text-muted-foreground">
                  Necesarias para que el sitio funcione. No se pueden desactivar.
                </p>
              </div>
              <Switch checked={true} disabled />
            </div>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="essential">
                <AccordionTrigger className="text-sm">
                  Ver {essentialCookies.length} cookies esenciales
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    {essentialCookies.map((cookie, idx) => (
                      <div key={idx} className="text-sm border-l-2 border-primary pl-3">
                        <p className="font-medium">{cookie.name}</p>
                        <p className="text-muted-foreground">{cookie.description}</p>
                        <p className="text-xs text-muted-foreground">Duración: {cookie.duration}</p>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <Separator />

          {/* Functional Cookies */}
          {functionalCookies.length > 0 && (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="functional" className="text-base font-semibold">
                      Cookies Funcionales
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Recuerdan tus preferencias y configuración (ej. tema).
                    </p>
                  </div>
                  <Switch
                    id="functional"
                    checked={preferences.functional}
                    onCheckedChange={(checked) =>
                      setPreferences({ ...preferences, functional: checked })
                    }
                  />
                </div>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="functional">
                    <AccordionTrigger className="text-sm">
                      Ver {functionalCookies.length} cookies funcionales
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3">
                        {functionalCookies.map((cookie, idx) => (
                          <div key={idx} className="text-sm border-l-2 border-blue-500 pl-3">
                            <p className="font-medium">{cookie.name}</p>
                            <p className="text-muted-foreground">{cookie.description}</p>
                            <p className="text-xs text-muted-foreground">Duración: {cookie.duration}</p>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
              <Separator />
            </>
          )}

          {/* Analytics Cookies */}
          {analyticsCookies.length > 0 && (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="analytics" className="text-base font-semibold">
                      Cookies de Análisis
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Nos ayudan a entender cómo usas el sitio para mejorarlo.
                    </p>
                  </div>
                  <Switch
                    id="analytics"
                    checked={preferences.analytics}
                    onCheckedChange={(checked) =>
                      setPreferences({ ...preferences, analytics: checked })
                    }
                  />
                </div>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="analytics">
                    <AccordionTrigger className="text-sm">
                      Ver {analyticsCookies.length} cookies de análisis
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3">
                        {analyticsCookies.map((cookie, idx) => (
                          <div key={idx} className="text-sm border-l-2 border-green-500 pl-3">
                            <p className="font-medium">{cookie.name}</p>
                            <p className="text-muted-foreground">{cookie.description}</p>
                            <p className="text-xs text-muted-foreground">Duración: {cookie.duration}</p>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
              <Separator />
            </>
          )}

          {/* Marketing Cookies */}
          {marketingCookies.length > 0 && (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="marketing" className="text-base font-semibold">
                      Cookies de Marketing
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Se usan para mostrarte anuncios relevantes.
                    </p>
                  </div>
                  <Switch
                    id="marketing"
                    checked={preferences.marketing}
                    onCheckedChange={(checked) =>
                      setPreferences({ ...preferences, marketing: checked })
                    }
                  />
                </div>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="marketing">
                    <AccordionTrigger className="text-sm">
                      Ver {marketingCookies.length} cookies de marketing
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3">
                        {marketingCookies.map((cookie, idx) => (
                          <div key={idx} className="text-sm border-l-2 border-orange-500 pl-3">
                            <p className="font-medium">{cookie.name}</p>
                            <p className="text-muted-foreground">{cookie.description}</p>
                            <p className="text-xs text-muted-foreground">Duración: {cookie.duration}</p>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={handleSave}>
            Guardar Preferencias
          </Button>
          <Button onClick={handleAcceptAll}>
            Aceptar Todo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
