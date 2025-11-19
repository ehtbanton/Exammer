import crypto from 'crypto';
import { db } from './db';

const TOKEN_EXPIRY_HOURS = 24;
const RATE_LIMIT_SECONDS = 60;

/**
 * Generate a cryptographically secure verification token
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new verification token for a user
 * Returns the token string if successful, or null if rate limited
 */
export async function createVerificationToken(email: string): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds

  // Check rate limiting - get user's last verification email timestamp
  const user = await db.get('SELECT email_verification_sent_at FROM users WHERE email = ?', [email]);

  if (user?.email_verification_sent_at) {
    const timeSinceLastEmail = now - user.email_verification_sent_at;
    if (timeSinceLastEmail < RATE_LIMIT_SECONDS) {
      console.log(`Rate limit: ${RATE_LIMIT_SECONDS - timeSinceLastEmail} seconds remaining`);
      return null;
    }
  }

  // Generate token
  const token = generateVerificationToken();
  const expiresAt = now + (TOKEN_EXPIRY_HOURS * 3600);

  // Delete any existing verification tokens for this email
  await db.run('DELETE FROM verification_tokens WHERE identifier = ?', [email]);

  // Insert new token
  await db.run(
    'INSERT INTO verification_tokens (identifier, token, expires) VALUES (?, ?, ?)',
    [email, token, expiresAt]
  );

  // Update user's last verification email timestamp
  await db.run(
    'UPDATE users SET email_verification_sent_at = ? WHERE email = ?',
    [now, email]
  );

  return token;
}

/**
 * Verify a token and mark the user's email as verified
 * Returns true if successful, false if token is invalid/expired
 */
export async function verifyEmailToken(token: string): Promise<{ success: boolean; email?: string; error?: string }> {
  const now = Math.floor(Date.now() / 1000);

  // Find the token
  const tokenRecord = await db.get(
    'SELECT identifier, expires FROM verification_tokens WHERE token = ?',
    [token]
  );

  if (!tokenRecord) {
    return { success: false, error: 'Invalid verification token' };
  }

  // Check if expired
  if (tokenRecord.expires < now) {
    // Delete expired token
    await db.run('DELETE FROM verification_tokens WHERE token = ?', [token]);
    return { success: false, error: 'Verification token has expired' };
  }

  const email = tokenRecord.identifier;

  // Update user's email_verified status
  await db.run(
    'UPDATE users SET email_verified = ? WHERE email = ?',
    [now, email]
  );

  // Delete the used token (one-time use)
  await db.run('DELETE FROM verification_tokens WHERE token = ?', [token]);

  return { success: true, email };
}

/**
 * Check if a user can request a new verification email (not rate limited)
 */
export async function canRequestVerificationEmail(email: string): Promise<{ allowed: boolean; remainingSeconds?: number }> {
  const now = Math.floor(Date.now() / 1000);

  const user = await db.get('SELECT email_verification_sent_at FROM users WHERE email = ?', [email]);

  if (!user?.email_verification_sent_at) {
    return { allowed: true };
  }

  const timeSinceLastEmail = now - user.email_verification_sent_at;
  if (timeSinceLastEmail < RATE_LIMIT_SECONDS) {
    return {
      allowed: false,
      remainingSeconds: RATE_LIMIT_SECONDS - timeSinceLastEmail
    };
  }

  return { allowed: true };
}

/**
 * Delete all expired verification tokens (cleanup function)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const now = Math.floor(Date.now() / 1000);

  const result = await db.run('DELETE FROM verification_tokens WHERE expires < ?', [now]);
  return result.changes || 0;
}
