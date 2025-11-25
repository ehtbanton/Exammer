import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailToken } from '@/lib/verification-tokens';
import { db } from '@/lib/db';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }

    // Verify the token
    const result = await verifyEmailToken(token);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Verification failed' },
        { status: 400 }
      );
    }

    // Create a one-time auto-login token (expires in 5 minutes)
    const autoLoginToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Math.floor(Date.now() / 1000) + (5 * 60); // 5 minutes

    await db.run(
      'INSERT INTO verification_tokens (identifier, token, expires) VALUES (?, ?, ?)',
      [`autologin:${result.email}`, autoLoginToken, expiresAt]
    );

    return NextResponse.json({
      message: 'Email verified successfully! Logging you in...',
      email: result.email,
      autoLoginToken
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { error: 'An error occurred during email verification' },
      { status: 500 }
    );
  }
}
