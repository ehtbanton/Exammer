/**
 * Rate limiting utilities for the Exammer app.
 * Uses better-sqlite3 for persistent storage across restarts.
 */

import Database from 'better-sqlite3';
import path from 'path';

// Initialize SQLite database for rate limiting
const dbPath = path.join(process.cwd(), 'db', 'rate-limits.db');
let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    // Create rate limit tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        points INTEGER NOT NULL,
        expire_at INTEGER NOT NULL
      )
    `);

    // Create index for cleanup
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_rate_limits_expire
      ON rate_limits(expire_at)
    `);
  }
  return db;
}

// Clean up expired entries periodically
function cleanupExpired(): void {
  const database = getDb();
  const now = Math.floor(Date.now() / 1000);
  database.prepare('DELETE FROM rate_limits WHERE expire_at < ?').run(now);
}

// Run cleanup every 5 minutes
setInterval(cleanupExpired, 5 * 60 * 1000);

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

interface RateLimiterConfig {
  points: number;      // Maximum number of points (requests)
  duration: number;    // Time window in seconds
  blockDuration?: number; // How long to block after limit exceeded (seconds)
}

/**
 * Generic rate limiter function
 */
export function checkRateLimit(
  key: string,
  config: RateLimiterConfig
): RateLimitResult {
  const database = getDb();
  const now = Math.floor(Date.now() / 1000);

  // Get current record
  const record = database.prepare(
    'SELECT points, expire_at FROM rate_limits WHERE key = ?'
  ).get(key) as { points: number; expire_at: number } | undefined;

  // If no record or expired, create new one
  if (!record || record.expire_at < now) {
    const expireAt = now + config.duration;
    database.prepare(
      'INSERT OR REPLACE INTO rate_limits (key, points, expire_at) VALUES (?, ?, ?)'
    ).run(key, 1, expireAt);

    return {
      success: true,
      remaining: config.points - 1,
      resetAt: expireAt,
    };
  }

  // Check if blocked (points exceed limit)
  if (record.points >= config.points) {
    // If blockDuration is set, extend the block
    if (config.blockDuration && record.expire_at < now + config.blockDuration) {
      const newExpireAt = now + config.blockDuration;
      database.prepare(
        'UPDATE rate_limits SET expire_at = ? WHERE key = ?'
      ).run(newExpireAt, key);

      return {
        success: false,
        remaining: 0,
        resetAt: newExpireAt,
      };
    }

    return {
      success: false,
      remaining: 0,
      resetAt: record.expire_at,
    };
  }

  // Increment points
  const newPoints = record.points + 1;
  database.prepare(
    'UPDATE rate_limits SET points = ? WHERE key = ?'
  ).run(newPoints, key);

  return {
    success: true,
    remaining: config.points - newPoints,
    resetAt: record.expire_at,
  };
}

/**
 * Pre-configured rate limiters for different use cases
 */

// Auth rate limiter: 5 attempts per 15 minutes, block for 1 hour if exceeded
export function checkAuthRateLimit(identifier: string): RateLimitResult {
  return checkRateLimit(`auth:${identifier}`, {
    points: 5,
    duration: 15 * 60, // 15 minutes
    blockDuration: 60 * 60, // 1 hour block
  });
}

// Signup rate limiter: 3 signups per hour per IP
export function checkSignupRateLimit(ip: string): RateLimitResult {
  return checkRateLimit(`signup:${ip}`, {
    points: 3,
    duration: 60 * 60, // 1 hour
  });
}

// Batch extraction rate limiter: 50 batches per day per user
export function checkBatchExtractionRateLimit(userId: string): RateLimitResult {
  return checkRateLimit(`batch:${userId}`, {
    points: 50,
    duration: 24 * 60 * 60, // 24 hours
  });
}

// Feedback rate limiter: 5 submissions per hour per IP
export function checkFeedbackRateLimit(ip: string): RateLimitResult {
  return checkRateLimit(`feedback:${ip}`, {
    points: 5,
    duration: 60 * 60, // 1 hour
  });
}

// Class join rate limiter: 10 attempts per hour per user
export function checkClassJoinRateLimit(userId: string): RateLimitResult {
  return checkRateLimit(`class-join:${userId}`, {
    points: 10,
    duration: 60 * 60, // 1 hour
  });
}

// Gemini token rate limiter: 10 requests per hour per user
export function checkGeminiTokenRateLimit(userId: string): RateLimitResult {
  return checkRateLimit(`gemini-token:${userId}`, {
    points: 10,
    duration: 60 * 60, // 1 hour
  });
}

/**
 * Token-based rate limiting for Gemini AI operations
 * Based on Google's cost metric: total tokens used (input + output)
 *
 * Default limits per user per day:
 * - 2,000,000 tokens (2M) - generous limit for users to fully test the product
 * - Adjustable via environment variable AI_TOKEN_LIMIT_PER_DAY
 */

interface TokenUsageRecord {
  tokens: number;
  expire_at: number;
}

// Get configured token limit (default 2M tokens per day per user)
const AI_TOKEN_LIMIT_PER_DAY = parseInt(process.env.AI_TOKEN_LIMIT_PER_DAY || '2000000', 10);

/**
 * Check if user has token budget remaining for AI operations
 */
export function checkAITokenBudget(userId: string): {
  allowed: boolean;
  remainingTokens: number;
  resetAt: number;
  limit: number;
} {
  const database = getDb();
  const now = Math.floor(Date.now() / 1000);
  const duration = 24 * 60 * 60; // 24 hour window

  const key = `ai-tokens:${userId}`;

  // Get current record
  const record = database.prepare(
    'SELECT points as tokens, expire_at FROM rate_limits WHERE key = ?'
  ).get(key) as TokenUsageRecord | undefined;

  // If no record or expired, user has full budget
  if (!record || record.expire_at < now) {
    return {
      allowed: true,
      remainingTokens: AI_TOKEN_LIMIT_PER_DAY,
      resetAt: now + duration,
      limit: AI_TOKEN_LIMIT_PER_DAY,
    };
  }

  const usedTokens = record.tokens;
  const remainingTokens = Math.max(0, AI_TOKEN_LIMIT_PER_DAY - usedTokens);

  return {
    allowed: remainingTokens > 0,
    remainingTokens,
    resetAt: record.expire_at,
    limit: AI_TOKEN_LIMIT_PER_DAY,
  };
}

/**
 * Record token usage for a user after an AI operation
 */
export function recordAITokenUsage(userId: string, tokensUsed: number): {
  totalUsed: number;
  remaining: number;
  resetAt: number;
} {
  const database = getDb();
  const now = Math.floor(Date.now() / 1000);
  const duration = 24 * 60 * 60; // 24 hour window

  const key = `ai-tokens:${userId}`;

  // Get current record
  const record = database.prepare(
    'SELECT points as tokens, expire_at FROM rate_limits WHERE key = ?'
  ).get(key) as TokenUsageRecord | undefined;

  let totalUsed: number;
  let expireAt: number;

  // If no record or expired, create new one
  if (!record || record.expire_at < now) {
    totalUsed = tokensUsed;
    expireAt = now + duration;
    database.prepare(
      'INSERT OR REPLACE INTO rate_limits (key, points, expire_at) VALUES (?, ?, ?)'
    ).run(key, totalUsed, expireAt);
  } else {
    // Add to existing usage
    totalUsed = record.tokens + tokensUsed;
    expireAt = record.expire_at;
    database.prepare(
      'UPDATE rate_limits SET points = ? WHERE key = ?'
    ).run(totalUsed, key);
  }

  const remaining = Math.max(0, AI_TOKEN_LIMIT_PER_DAY - totalUsed);

  console.log(
    `[AI Token Usage] User ${userId}: +${tokensUsed} tokens ` +
    `(total: ${totalUsed}/${AI_TOKEN_LIMIT_PER_DAY}, remaining: ${remaining})`
  );

  return {
    totalUsed,
    remaining,
    resetAt: expireAt,
  };
}

/**
 * Get current token usage stats for a user
 */
export function getAITokenUsage(userId: string): {
  used: number;
  remaining: number;
  limit: number;
  resetAt: number;
} {
  const budget = checkAITokenBudget(userId);
  return {
    used: budget.limit - budget.remainingTokens,
    remaining: budget.remainingTokens,
    limit: budget.limit,
    resetAt: budget.resetAt,
  };
}

// API general rate limiter: 100 requests per minute per IP
export function checkAPIRateLimit(ip: string): RateLimitResult {
  return checkRateLimit(`api:${ip}`, {
    points: 100,
    duration: 60, // 1 minute
  });
}

/**
 * Helper to get IP from Next.js request
 */
export function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  return 'unknown';
}

/**
 * Helper to create rate limit error response
 */
export function rateLimitResponse(resetAt: number): Response {
  const retryAfter = Math.max(0, resetAt - Math.floor(Date.now() / 1000));
  return new Response(
    JSON.stringify({
      error: 'Too many requests. Please try again later.',
      retryAfter
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
      },
    }
  );
}
