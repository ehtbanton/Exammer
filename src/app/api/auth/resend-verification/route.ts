import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { User } from '@/lib/db';
import { createVerificationToken, canRequestVerificationEmail } from '@/lib/verification-tokens';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await db.get<User>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      // Don't reveal if user exists or not (security best practice)
      return NextResponse.json({
        message: 'If an account with that email exists and is unverified, a verification email has been sent.'
      });
    }

    // Check if already verified
    if (user.email_verified) {
      return NextResponse.json({
        message: 'This email is already verified. You can sign in.'
      });
    }

    // Check rate limiting
    const rateLimitCheck = await canRequestVerificationEmail(email);

    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Please wait ${rateLimitCheck.remainingSeconds} seconds before requesting another verification email.`
        },
        { status: 429 }
      );
    }

    // Create verification token
    const token = await createVerificationToken(email);

    if (!token) {
      return NextResponse.json(
        { error: 'Failed to create verification token. Please try again.' },
        { status: 500 }
      );
    }

    // Send verification email
    const verificationUrl = `${process.env.NEXTAUTH_URL}/auth/verify-email?token=${token}`;

    try {
      await sendVerificationEmail(email, verificationUrl);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      return NextResponse.json(
        { error: 'Failed to send verification email. Please try again later.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Verification email sent! Please check your inbox.'
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { error: 'An error occurred while resending verification email' },
      { status: 500 }
    );
  }
}
