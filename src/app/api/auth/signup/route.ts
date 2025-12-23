import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { db } from '@/lib/db';
import type { User } from '@/lib/db';
import { createVerificationToken } from '@/lib/verification-tokens';
import { sendVerificationEmail } from '@/lib/email';
import { syncNewUser } from '@/lib/user-access-sync';

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.get<User>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hash(password, 12);

    // Create user with email NOT verified and access_level 0 (no access until verified)
    const result = await db.run(
      'INSERT INTO users (email, password_hash, name, email_verified, access_level) VALUES (?, ?, ?, ?, ?)',
      [email, hashedPassword, name || null, 0, 0]
    );

    // Sync user to users.json immediately
    await syncNewUser();

    // Create verification token
    const token = await createVerificationToken(email);

    if (!token) {
      // This shouldn't happen for new users, but handle it gracefully
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
      // Don't fail the signup if email fails - user can resend later
    }

    return NextResponse.json(
      {
        message: 'Account created successfully! Please check your email to verify your account.',
        userId: result.lastID,
        requiresVerification: true
      }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'An error occurred during signup' },
      { status: 500 }
    );
  }
}
