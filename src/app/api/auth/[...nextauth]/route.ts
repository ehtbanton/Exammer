import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { checkAuthRateLimit, getClientIP } from '@/lib/rate-limiter';

const handler = NextAuth(authOptions);

// Wrap the POST handler to add rate limiting for login attempts
async function rateLimitedPost(req: NextRequest) {
  // Only rate limit the credentials signin action
  const url = new URL(req.url);
  const isSignIn = url.pathname.endsWith('/callback/credentials');

  if (isSignIn) {
    const ip = getClientIP(req);
    const rateLimit = checkAuthRateLimit(ip);

    if (!rateLimit.success) {
      const retryAfter = Math.max(0, rateLimit.resetAt - Math.floor(Date.now() / 1000));
      return NextResponse.json(
        {
          error: 'TooManyRequests',
          message: 'Too many login attempts. Please try again later.',
        },
        {
          status: 429,
          headers: { 'Retry-After': retryAfter.toString() }
        }
      );
    }
  }

  // @ts-ignore - NextAuth handler expects specific types
  return handler(req);
}

export { handler as GET, rateLimitedPost as POST };
