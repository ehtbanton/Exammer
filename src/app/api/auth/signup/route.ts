import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { db } from '@/lib/db';
import type { User } from '@/lib/db';
import crypto from 'crypto';

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

    // Create user
    const result = await db.run(
      'INSERT INTO users (email, password_hash, name, email_verified) VALUES (?, ?, ?, ?)',
      [email, hashedPassword, name || null, 0]
    );

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours

    await db.run(
      'INSERT INTO verification_tokens (identifier, token, expires) VALUES (?, ?, ?)',
      [email, verificationToken, expiresAt]
    );

    // TODO: Send verification email
    // For now, we'll just return the token in development
    const verificationUrl = `${process.env.NEXTAUTH_URL}/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;

    return NextResponse.json({
      message: 'User created successfully. Please verify your email.',
      userId: result.lastID,
      // Remove this in production and send via email instead
      verificationUrl: process.env.NODE_ENV === 'development' ? verificationUrl : undefined,
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'An error occurred during signup' },
      { status: 500 }
    );
  }
}
