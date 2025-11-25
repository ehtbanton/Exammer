'use client';

import { useEffect, useState } from 'react';
import {
  CookiePreferences,
  getCookiePreferences,
  shouldAllowCookie,
  CookieCategory,
  COOKIE_PREFERENCES_KEY,
} from '@/lib/cookie-consent';

export function useCookieConsent() {
  const [preferences, setPreferences] = useState<CookiePreferences | null>(null);

  useEffect(() => {
    // Load preferences on mount
    setPreferences(getCookiePreferences());

    // Listen for changes to preferences
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === COOKIE_PREFERENCES_KEY) {
        setPreferences(getCookiePreferences());
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return {
    preferences,
    hasConsented: preferences !== null,
    allowsCategory: (category: CookieCategory) => shouldAllowCookie(category),
  };
}

// Example usage in components:
// const { allowsCategory } = useCookieConsent();
// if (allowsCategory('analytics')) {
//   // Load Google Analytics
// }
