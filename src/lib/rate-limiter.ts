/**
 * Rate limiting utilities for the Exammer app.
 * Uses better-sqlite3 for persistent storage across restarts.
 */

import Database from 'better-sqlite3';
import path from 'path';

// List of trusted proxy IPs (add your reverse proxy/load balancer IPs here)
// For Vercel, this should include Vercel's edge network IPs
const TRUSTED_PROXY_IPS = new Set([
  // Add your trusted proxy IPs here
  // e.g., '10.0.0.1', '192.168.1.1'
  // For Vercel deployment, Vercel handles this automatically
]);

// Whether we're behind a trusted proxy (Vercel, Cloudflare, etc.)
// Set this via environment variable in production
const TRUST_PROXY = process.env.TRUST_PROXY === 'true' || process.env.VERCEL === '1';

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

// Auth rate limiter: 15 attempts per 15 minutes, block for 1 hour if exceeded
export function checkAuthRateLimit(identifier: string): RateLimitResult {
  return checkRateLimit(`auth:${identifier}`, {
    points: 15,
    duration: 15 * 60, // 15 minutes
    blockDuration: 60 * 60, // 1 hour block
  });
}

// Signup rate limiter: 9 signups per hour per IP
export function checkSignupRateLimit(ip: string): RateLimitResult {
  return checkRateLimit(`signup:${ip}`, {
    points: 9,
    duration: 60 * 60, // 1 hour
  });
}

// Batch extraction rate limiter: 20 batches per day per user
export function checkBatchExtractionRateLimit(userId: string): RateLimitResult {
  return checkRateLimit(`batch:${userId}`, {
    points: 20,
    duration: 24 * 60 * 60, // 24 hours
  });
}

// Feedback rate limiter: 15 submissions per hour per IP
export function checkFeedbackRateLimit(ip: string): RateLimitResult {
  return checkRateLimit(`feedback:${ip}`, {
    points: 15,
    duration: 60 * 60, // 1 hour
  });
}

// Class join rate limiter: 30 attempts per hour per user
export function checkClassJoinRateLimit(userId: string): RateLimitResult {
  return checkRateLimit(`class-join:${userId}`, {
    points: 30,
    duration: 60 * 60, // 1 hour
  });
}

// Gemini token rate limiter: 30 requests per hour per user
export function checkGeminiTokenRateLimit(userId: string): RateLimitResult {
  return checkRateLimit(`gemini-token:${userId}`, {
    points: 30,
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

// API general rate limiter: 300 requests per minute per IP
export function checkAPIRateLimit(ip: string): RateLimitResult {
  return checkRateLimit(`api:${ip}`, {
    points: 300,
    duration: 60, // 1 minute
  });
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

/**
 * Helper to get IP from Next.js request
 * Includes security measures against IP spoofing
 */
export function getClientIP(req: Request): string {
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
      console.warn(`[Rate Limit] Invalid x-forwarded-for IP: ${clientIP}`);
    }

    const realIP = req.headers.get('x-real-ip');
    if (realIP) {
      const sanitized = sanitizeIP(realIP);
      if (isValidIP(sanitized)) {
        return sanitized;
      }
      console.warn(`[Rate Limit] Invalid x-real-ip: ${realIP}`);
    }
  }

  // Fallback: Try to get direct connection IP
  // Note: This may not work in all environments
  const connectionIP = (req as unknown as { ip?: string }).ip;
  if (connectionIP) {
    const sanitized = sanitizeIP(connectionIP);
    if (isValidIP(sanitized)) {
      return sanitized;
    }
  }

  // Final fallback with warning
  console.warn('[Rate Limit] Could not determine client IP, using fallback. Consider setting TRUST_PROXY=true if behind a proxy.');
  return '0.0.0.0';
}

/**
 * Log admin rate limit bypass for audit purposes
 */
export function logAdminBypass(
  userId: string,
  action: string,
  details?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    type: 'ADMIN_RATE_LIMIT_BYPASS',
    userId,
    action,
    ...details,
  };

  // Log to console (in production, this should go to a proper logging service)
  console.log(`[AUDIT] ${JSON.stringify(logEntry)}`);

  // You can also store in database for persistent audit trail
  // TODO: Implement database audit logging if needed
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

/**
 * Create rate limit headers for successful responses
 * This helps clients understand their current rate limit status
 */
export function createRateLimitHeaders(result: RateLimitResult, limit: number): Record<string, string> {
  const resetSeconds = Math.max(0, result.resetAt - Math.floor(Date.now() / 1000));
  return {
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetAt.toString(),
    'X-RateLimit-Reset-After': resetSeconds.toString(),
  };
}

/**
 * Token reservation system for pessimistic locking
 * Prevents race conditions by reserving tokens before execution
 */

interface TokenReservation {
  userId: string;
  reservationId: string;
  estimatedTokens: number;
  createdAt: number;
}

// In-memory reservations (short-lived, cleaned up on completion or timeout)
const activeReservations = new Map<string, TokenReservation>();

// Reservation timeout (5 minutes)
const RESERVATION_TIMEOUT_MS = 5 * 60 * 1000;

// Cleanup expired reservations periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, reservation] of activeReservations.entries()) {
    if (now - reservation.createdAt > RESERVATION_TIMEOUT_MS) {
      console.warn(`[AI Token] Reservation ${id} expired without being completed`);
      activeReservations.delete(id);
    }
  }
}, 60 * 1000); // Cleanup every minute

/**
 * Reserve tokens before AI execution (pessimistic locking)
 * This deducts the estimated tokens immediately to prevent race conditions
 */
export function reserveAITokens(
  userId: string,
  estimatedTokens: number
): {
  success: boolean;
  reservationId?: string;
  remainingTokens: number;
  resetAt: number;
  error?: string;
} {
  const database = getDb();
  const now = Math.floor(Date.now() / 1000);
  const duration = 24 * 60 * 60;

  const key = `ai-tokens:${userId}`;

  // Use a transaction for atomic read-modify-write
  const result = database.transaction(() => {
    // Get current record
    const record = database.prepare(
      'SELECT points as tokens, expire_at FROM rate_limits WHERE key = ?'
    ).get(key) as TokenUsageRecord | undefined;

    let currentUsage = 0;
    let expireAt = now + duration;

    if (record && record.expire_at >= now) {
      currentUsage = record.tokens;
      expireAt = record.expire_at;
    }

    const remainingTokens = AI_TOKEN_LIMIT_PER_DAY - currentUsage;

    // Check if there's enough budget
    if (remainingTokens < estimatedTokens) {
      return {
        success: false,
        remainingTokens,
        resetAt: expireAt,
        error: `Insufficient token budget. Need ${estimatedTokens.toLocaleString()}, have ${remainingTokens.toLocaleString()}`,
      };
    }

    // Pre-deduct the estimated tokens
    const newUsage = currentUsage + estimatedTokens;
    database.prepare(
      'INSERT OR REPLACE INTO rate_limits (key, points, expire_at) VALUES (?, ?, ?)'
    ).run(key, newUsage, expireAt);

    // Create reservation
    const reservationId = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      reservationId,
      remainingTokens: AI_TOKEN_LIMIT_PER_DAY - newUsage,
      resetAt: expireAt,
      preDeductedTokens: estimatedTokens,
    };
  })();

  // Store reservation in memory
  if (result.success && result.reservationId) {
    activeReservations.set(result.reservationId, {
      userId,
      reservationId: result.reservationId,
      estimatedTokens,
      createdAt: Date.now(),
    });
  }

  return result;
}

/**
 * Complete a token reservation and adjust for actual usage
 * Call this after AI execution completes
 */
export function completeTokenReservation(
  reservationId: string,
  actualTokensUsed: number
): {
  success: boolean;
  adjusted: number;
  totalUsed: number;
  remaining: number;
} {
  const reservation = activeReservations.get(reservationId);

  if (!reservation) {
    console.warn(`[AI Token] Reservation ${reservationId} not found (may have expired)`);
    return {
      success: false,
      adjusted: 0,
      totalUsed: 0,
      remaining: 0,
    };
  }

  activeReservations.delete(reservationId);

  const database = getDb();
  const now = Math.floor(Date.now() / 1000);
  const key = `ai-tokens:${reservation.userId}`;

  // Calculate adjustment (positive = used less than estimated, negative = used more)
  const adjustment = reservation.estimatedTokens - actualTokensUsed;

  // Adjust the token count
  const result = database.transaction(() => {
    const record = database.prepare(
      'SELECT points as tokens, expire_at FROM rate_limits WHERE key = ?'
    ).get(key) as TokenUsageRecord | undefined;

    if (!record || record.expire_at < now) {
      // Record expired during execution, just log actual usage
      const expireAt = now + 24 * 60 * 60;
      database.prepare(
        'INSERT OR REPLACE INTO rate_limits (key, points, expire_at) VALUES (?, ?, ?)'
      ).run(key, actualTokensUsed, expireAt);

      return {
        totalUsed: actualTokensUsed,
        remaining: AI_TOKEN_LIMIT_PER_DAY - actualTokensUsed,
      };
    }

    // Adjust: subtract reserved, add actual
    const newUsage = Math.max(0, record.tokens - reservation.estimatedTokens + actualTokensUsed);
    database.prepare(
      'UPDATE rate_limits SET points = ? WHERE key = ?'
    ).run(newUsage, key);

    return {
      totalUsed: newUsage,
      remaining: Math.max(0, AI_TOKEN_LIMIT_PER_DAY - newUsage),
    };
  })();

  console.log(
    `[AI Token] Reservation ${reservationId} completed. ` +
    `Estimated: ${reservation.estimatedTokens}, Actual: ${actualTokensUsed}, ` +
    `Adjusted: ${adjustment > 0 ? '+' : ''}${adjustment} tokens`
  );

  return {
    success: true,
    adjusted: adjustment,
    ...result,
  };
}

/**
 * Cancel a token reservation (refund the pre-deducted tokens)
 */
export function cancelTokenReservation(reservationId: string): boolean {
  const reservation = activeReservations.get(reservationId);

  if (!reservation) {
    return false;
  }

  activeReservations.delete(reservationId);

  const database = getDb();
  const now = Math.floor(Date.now() / 1000);
  const key = `ai-tokens:${reservation.userId}`;

  // Refund the reserved tokens
  database.transaction(() => {
    const record = database.prepare(
      'SELECT points as tokens, expire_at FROM rate_limits WHERE key = ?'
    ).get(key) as TokenUsageRecord | undefined;

    if (record && record.expire_at >= now) {
      const newUsage = Math.max(0, record.tokens - reservation.estimatedTokens);
      database.prepare(
        'UPDATE rate_limits SET points = ? WHERE key = ?'
      ).run(newUsage, key);
    }
  })();

  console.log(
    `[AI Token] Reservation ${reservationId} cancelled. ` +
    `Refunded ${reservation.estimatedTokens} tokens for user ${reservation.userId}`
  );

  return true;
}
