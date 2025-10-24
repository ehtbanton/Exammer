import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { db } from '@/lib/db';
import type { User } from '@/lib/db';
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

    // Create user with email already verified
    const result = await db.run(
      'INSERT INTO users (email, password_hash, name, email_verified) VALUES (?, ?, ?, ?)',
      [email, hashedPassword, name || null, 1]
    );

    // Sync new user to pending-users.json
    await syncNewUser();

    return NextResponse.json({
      message: 'User created successfully. You can now sign in.',
      userId: result.lastID,
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'An error occurred during signup' },
      { status: 500 }
    );
  }
}
