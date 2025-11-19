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
          <DialogTitle>Cookie Preferences</DialogTitle>
          <DialogDescription>
            Manage which cookies you want to allow. Essential cookies are required for the site to function and cannot be disabled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Essential Cookies */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-semibold">Essential Cookies</Label>
                <p className="text-sm text-muted-foreground">
                  Required for the website to function. Cannot be disabled.
                </p>
              </div>
              <Switch checked={true} disabled />
            </div>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="essential">
                <AccordionTrigger className="text-sm">
                  View {essentialCookies.length} essential cookies
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    {essentialCookies.map((cookie, idx) => (
                      <div key={idx} className="text-sm border-l-2 border-primary pl-3">
                        <p className="font-medium">{cookie.name}</p>
                        <p className="text-muted-foreground">{cookie.description}</p>
                        <p className="text-xs text-muted-foreground">Duration: {cookie.duration}</p>
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
                      Functional Cookies
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Remember your preferences and settings (e.g., theme).
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
                      View {functionalCookies.length} functional cookies
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3">
                        {functionalCookies.map((cookie, idx) => (
                          <div key={idx} className="text-sm border-l-2 border-blue-500 pl-3">
                            <p className="font-medium">{cookie.name}</p>
                            <p className="text-muted-foreground">{cookie.description}</p>
                            <p className="text-xs text-muted-foreground">Duration: {cookie.duration}</p>
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
                      Analytics Cookies
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Help us understand how you use the site to improve it.
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
                      View {analyticsCookies.length} analytics cookies
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3">
                        {analyticsCookies.map((cookie, idx) => (
                          <div key={idx} className="text-sm border-l-2 border-green-500 pl-3">
                            <p className="font-medium">{cookie.name}</p>
                            <p className="text-muted-foreground">{cookie.description}</p>
                            <p className="text-xs text-muted-foreground">Duration: {cookie.duration}</p>
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
                      Marketing Cookies
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Used to show you relevant advertisements.
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
                      View {marketingCookies.length} marketing cookies
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3">
                        {marketingCookies.map((cookie, idx) => (
                          <div key={idx} className="text-sm border-l-2 border-orange-500 pl-3">
                            <p className="font-medium">{cookie.name}</p>
                            <p className="text-muted-foreground">{cookie.description}</p>
                            <p className="text-xs text-muted-foreground">Duration: {cookie.duration}</p>
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
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleSave}>
            Save Preferences
          </Button>
          <Button onClick={handleAcceptAll}>
            Accept All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
