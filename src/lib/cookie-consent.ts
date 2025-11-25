export type CookieCategory = 'essential' | 'functional' | 'analytics' | 'marketing';

export interface CookiePreferences {
  essential: boolean; // Always true, can't be disabled
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

export interface CookieDetails {
  name: string;
  category: CookieCategory;
  description: string;
  duration: string;
  required: boolean;
}

export const COOKIE_CONSENT_KEY = 'exammer-cookie-consent';
export const COOKIE_PREFERENCES_KEY = 'exammer-cookie-preferences';

// Define all cookies used by the application
export const COOKIES: CookieDetails[] = [
  // Essential cookies (cannot be disabled)
  {
    name: 'next-auth.session-token',
    category: 'essential',
    description: 'Keeps you signed in to your account',
    duration: '30 days',
    required: true,
  },
  {
    name: 'next-auth.csrf-token',
    category: 'essential',
    description: 'Protects against cross-site request forgery attacks',
    duration: 'Session',
    required: true,
  },
  {
    name: 'next-auth.callback-url',
    category: 'essential',
    description: 'Manages authentication redirects',
    duration: 'Session',
    required: true,
  },
  {
    name: 'exammer-cookie-consent',
    category: 'essential',
    description: 'Remembers your cookie consent choice',
    duration: '1 year',
    required: true,
  },
  {
    name: 'exammer-cookie-preferences',
    category: 'essential',
    description: 'Stores your cookie category preferences',
    duration: '1 year',
    required: true,
  },
  // Functional cookies
  {
    name: 'theme',
    category: 'functional',
    description: 'Remembers your dark/light mode preference',
    duration: '1 year',
    required: false,
  },
  // Analytics cookies (not currently used, but prepared for future)
  {
    name: '_ga',
    category: 'analytics',
    description: 'Google Analytics - Tracks anonymous usage statistics',
    duration: '2 years',
    required: false,
  },
  {
    name: '_ga_*',
    category: 'analytics',
    description: 'Google Analytics - Tracks anonymous usage statistics',
    duration: '2 years',
    required: false,
  },
];

export const DEFAULT_PREFERENCES: CookiePreferences = {
  essential: true,
  functional: true,
  analytics: false,
  marketing: false,
};

export function getCookiePreferences(): CookiePreferences | null {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem(COOKIE_PREFERENCES_KEY);
  if (!stored) return null;

  try {
    const preferences = JSON.parse(stored);
    // Ensure essential is always true
    return { ...preferences, essential: true };
  } catch {
    return null;
  }
}

export function setCookiePreferences(preferences: CookiePreferences): void {
  if (typeof window === 'undefined') return;

  // Ensure essential is always true
  const safePreferences = { ...preferences, essential: true };
  localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(safePreferences));
  localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');

  // Enforce preferences by deleting cookies from disabled categories
  enforceCookiePreferences(safePreferences);
}

export function hasConsented(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(COOKIE_CONSENT_KEY) === 'accepted';
}

export function acceptAllCookies(): void {
  setCookiePreferences({
    essential: true,
    functional: true,
    analytics: true,
    marketing: true,
  });
}

export function acceptEssentialOnly(): void {
  setCookiePreferences({
    essential: true,
    functional: false,
    analytics: false,
    marketing: false,
  });
}

function enforceCookiePreferences(preferences: CookiePreferences): void {
  // Get all cookies that should be deleted based on preferences
  const cookiesToDelete = COOKIES.filter(cookie => {
    if (cookie.required) return false; // Never delete required cookies

    switch (cookie.category) {
      case 'functional':
        return !preferences.functional;
      case 'analytics':
        return !preferences.analytics;
      case 'marketing':
        return !preferences.marketing;
      default:
        return false;
    }
  });

  // Delete cookies from disabled categories
  cookiesToDelete.forEach(cookie => {
    deleteCookie(cookie.name);
  });
}

function deleteCookie(name: string): void {
  // Handle wildcard cookies
  if (name.includes('*')) {
    const prefix = name.replace('*', '');
    document.cookie.split(';').forEach(cookie => {
      const cookieName = cookie.split('=')[0].trim();
      if (cookieName.startsWith(prefix)) {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    });
  } else {
    // Delete specific cookie
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    // Also try with domain
    const domain = window.location.hostname;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${domain};`;
  }
}

export function shouldAllowCookie(category: CookieCategory): boolean {
  const preferences = getCookiePreferences();
  if (!preferences) return category === 'essential'; // Only allow essential if no preference set

  return preferences[category];
}
