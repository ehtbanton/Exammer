import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// In-memory rate limiting for Edge runtime
// Note: This won't persist across serverless function instances
// For production, consider using Vercel KV or Upstash Redis
const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();

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

function checkGlobalRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  cleanupOldEntries();

  const now = Date.now();
  const windowMs = 60000; // 1 minute window
  const maxRequests = 100; // 100 requests per minute per IP

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
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  // In development, use a default IP
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
