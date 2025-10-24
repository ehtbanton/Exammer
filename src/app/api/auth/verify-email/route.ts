import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { User, VerificationToken } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { token, email } = await req.json();

    if (!token || !email) {
      return NextResponse.json(
        { error: 'Token and email are required' },
        { status: 400 }
      );
    }

    // Find the verification token
    const verificationToken = await db.get<VerificationToken>(
      'SELECT * FROM verification_tokens WHERE identifier = ? AND token = ?',
      [email, token]
    );

    if (!verificationToken) {
      return NextResponse.json(
        { error: 'Invalid verification token' },
        { status: 400 }
      );
    }

    // Check if token has expired
    const now = Math.floor(Date.now() / 1000);
    if (verificationToken.expires < now) {
      // Delete expired token
      await db.run(
        'DELETE FROM verification_tokens WHERE identifier = ? AND token = ?',
        [email, token]
      );
      return NextResponse.json(
        { error: 'Verification token has expired' },
        { status: 400 }
      );
    }

    // Update user's email_verified status
    await db.run(
      'UPDATE users SET email_verified = 1, updated_at = unixepoch() WHERE email = ?',
      [email]
    );

    // Delete the used token
    await db.run(
      'DELETE FROM verification_tokens WHERE identifier = ? AND token = ?',
      [email, token]
    );

    return NextResponse.json({
      message: 'Email verified successfully. You can now sign in.',
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { error: 'An error occurred during email verification' },
      { status: 500 }
    );
  }
}
