import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// In-memory rate limiting for Edge runtime
// WARNING: This won't persist across serverless function instances or cold starts!
// For production environments with significant traffic, implement with:
// - Vercel KV (https://vercel.com/docs/storage/vercel-kv)
// - Upstash Redis (https://upstash.com/)
// - Or another edge-compatible key-value store
const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();

// Whether we're behind a trusted proxy (Vercel, Cloudflare, etc.)
const TRUST_PROXY = process.env.TRUST_PROXY === 'true' || process.env.VERCEL === '1';

// Cleanup old entries every minute
const CLEANUP_INTERVAL = 60000;
let lastCleanup = Date.now();

function cleanupOldEntries() {
  const now = Date.now();
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    for (const [key, value] of ipRequestCounts.entries()) {
      if (now > value.resetTime) {
        ipRequestCounts.delete(key);
      }
    }
    lastCleanup = now;
  }
}

/**
 * Validate that an IP address has a valid format
 */
function isValidIP(ip: string): boolean {
  // IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.').map(Number);
    return parts.every(part => part >= 0 && part <= 255);
  }

  // IPv6 validation (simplified)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv6Regex.test(ip);
}

/**
 * Sanitize IP address to prevent injection attacks
 */
function sanitizeIP(ip: string): string {
  // Remove any potentially dangerous characters
  const sanitized = ip.trim().replace(/[^0-9a-fA-F.:]/g, '');

  // Limit length to prevent DoS via long strings
  if (sanitized.length > 45) { // Max IPv6 length
    return sanitized.substring(0, 45);
  }

  return sanitized;
}

function checkGlobalRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  cleanupOldEntries();

  const now = Date.now();
  const windowMs = 60000; // 1 minute window
  const maxRequests = 300; // 300 requests per minute per IP

  const record = ipRequestCounts.get(ip);

  if (record && now < record.resetTime) {
    if (record.count >= maxRequests) {
      return {
        allowed: false,
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      };
    }
    record.count++;
    return { allowed: true };
  }

  // Create new record
  ipRequestCounts.set(ip, {
    count: 1,
    resetTime: now + windowMs,
  });

  return { allowed: true };
}

function getClientIP(req: NextRequest): string {
  // Only trust proxy headers if we're configured to do so
  if (TRUST_PROXY) {
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) {
      // Take the first IP (client IP) from the chain
      const clientIP = forwarded.split(',')[0].trim();
      const sanitized = sanitizeIP(clientIP);

      if (isValidIP(sanitized)) {
        return sanitized;
      }
      // If the forwarded IP is invalid, log it and fall through
      console.warn(`[Middleware Rate Limit] Invalid x-forwarded-for IP: ${clientIP}`);
    }

    const realIP = req.headers.get('x-real-ip');
    if (realIP) {
      const sanitized = sanitizeIP(realIP);
      if (isValidIP(sanitized)) {
        return sanitized;
      }
      console.warn(`[Middleware Rate Limit] Invalid x-real-ip: ${realIP}`);
    }
  }

  // Try NextRequest's ip property (available in some environments)
  // Note: This property may not exist in all Next.js versions
  const reqIp = (req as unknown as { ip?: string }).ip;
  if (reqIp) {
    const sanitized = sanitizeIP(reqIp);
    if (isValidIP(sanitized)) {
      return sanitized;
    }
  }

  // In development or when IP cannot be determined, use a default
  // This prevents the rate limiter from blocking everyone
  return '127.0.0.1';
}

export default withAuth(
  function middleware(req) {
    // Apply global rate limiting
    const ip = getClientIP(req);
    const rateLimit = checkGlobalRateLimit(ip);

    if (!rateLimit.allowed) {
      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests. Please try again later.',
          retryAfter: rateLimit.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimit.retryAfter || 60),
          },
        }
      );
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/auth/signin',
    },
  }
);

export const config = {
  // Protect all routes except auth pages and public assets
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - auth (auth pages)
     * - api/auth (NextAuth API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - exammer.png (logo)
     */
    '/((?!auth|api/auth|_next/static|_next/image|favicon.ico|exammer.png).*)',
  ],
};
