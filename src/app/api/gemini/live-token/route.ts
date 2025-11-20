import { NextResponse } from 'next/server'
import { geminiApiKeyManager } from '@root/gemini-api-key-manager'
import { requireAuth, getUserWithAccessLevel } from '@/lib/auth-helpers'
import { checkGeminiTokenRateLimit, logAdminBypass } from '@/lib/rate-limiter'

export async function GET() {
  try {
    // SECURITY: Require authentication to access API keys
    const user = await requireAuth();

    // Check if user is admin (level 3) - admins bypass rate limits
    const fullUser = await getUserWithAccessLevel(user.id);
    const isAdmin = fullUser?.access_level === 3;

    // Rate limiting: 30 requests per hour per user (unless admin)
    if (!isAdmin) {
      const rateLimit = checkGeminiTokenRateLimit(user.id);

      if (!rateLimit.success) {
        const retryAfter = Math.max(0, rateLimit.resetAt - Math.floor(Date.now() / 1000));
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          {
            status: 429,
            headers: { 'Retry-After': retryAfter.toString() }
          }
        )
      }
    } else {
      logAdminBypass(user.id, 'GEMINI_TOKEN_RATE_LIMIT');
    }

    // Get keys directly without acquire/release since this is for client-side WebSocket usage
    // The key manager's acquire/release pattern is for server-side API calls
    const keys = geminiApiKeyManager.getAllKeys()

    if (!keys || keys.length === 0) {
      return NextResponse.json(
        { error: 'No API keys available' },
        { status: 503 }
      )
    }

    // Return the first available key for client-side Gemini Live connection
    return NextResponse.json({ apiKey: keys[0] })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    console.error('Error getting API key:', error)
    return NextResponse.json(
      { error: 'Failed to get API key' },
      { status: 500 }
    )
  }
}
