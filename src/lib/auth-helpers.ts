import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import type { User } from '@/lib/db';

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

// Get full user data including access level from database
export async function getUserWithAccessLevel(userId: string): Promise<User | undefined> {
  return await db.get<User>('SELECT * FROM users WHERE id = ?', [userId]);
}
