import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hash } from 'bcryptjs';
import { db } from '@/lib/db';
import type { User } from '@/lib/db';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await db.get<User>('SELECT * FROM users WHERE id = ?', [session.user.id]);
  if (!user || user.access_level !== 3) return null;
  return user;
}

// GET: List all users
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const users = await db.all<User>(
    'SELECT id, email, name, access_level, email_verified, created_at FROM users ORDER BY created_at DESC'
  );

  return NextResponse.json({ users });
}

// POST: Create a new user (admin-created, no email verification needed)
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { email, password, name, accessLevel } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  if (password.length < 4) {
    return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
  }

  const existing = await db.get<User>('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 });
  }

  const hashedPassword = await hash(password, 10);
  const level = [0, 1, 2, 3].includes(accessLevel) ? accessLevel : 1;

  const result = await db.run(
    'INSERT INTO users (email, password_hash, name, email_verified, access_level) VALUES (?, ?, ?, 1, ?)',
    [email, hashedPassword, name || null, level]
  );

  return NextResponse.json({
    id: result.lastID,
    email,
    name: name || null,
    access_level: level,
  });
}

// DELETE: Delete a user
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { userId } = await req.json();

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  // Prevent deleting yourself
  if (Number(userId) === admin.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  await db.run('DELETE FROM users WHERE id = ?', [userId]);

  return NextResponse.json({ success: true });
}

// PATCH: Reset a user's password or change access level
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { userId, newPassword, accessLevel } = await req.json();

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  // Change access level
  if (accessLevel !== undefined) {
    if (Number(userId) === admin.id) {
      return NextResponse.json({ error: 'Cannot change your own access level' }, { status: 400 });
    }
    if (![0, 1, 2, 3].includes(accessLevel)) {
      return NextResponse.json({ error: 'Invalid access level' }, { status: 400 });
    }
    await db.run('UPDATE users SET access_level = ?, updated_at = unixepoch() WHERE id = ?', [accessLevel, userId]);
    return NextResponse.json({ success: true });
  }

  // Reset password
  if (newPassword) {
    if (newPassword.length < 4) {
      return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
    }
    const hashedPassword = await hash(newPassword, 10);
    await db.run('UPDATE users SET password_hash = ?, updated_at = unixepoch() WHERE id = ?', [hashedPassword, userId]);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'No action specified' }, { status: 400 });
}
