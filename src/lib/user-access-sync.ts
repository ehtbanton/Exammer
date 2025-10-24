import fs from 'fs/promises';
import path from 'path';
import { db } from './db';
import type { User } from './db';

const PENDING_USERS_FILE = path.join(process.cwd(), 'db', 'pending-users.json');

interface PendingUser {
  id: number;
  email: string;
  name?: string;
  created_at: number;
}

/**
 * Initialize the user access sync system by ensuring the pending-users.json file exists
 */
export async function initializeUserAccessSync(): Promise<void> {
  try {
    // Check if the file exists
    await fs.access(PENDING_USERS_FILE);
  } catch {
    // File doesn't exist, create it with an empty array
    await fs.writeFile(PENDING_USERS_FILE, JSON.stringify([], null, 2), 'utf-8');
    console.log('Created pending-users.json file');
  }

  // Sync existing users with access_level 0
  await syncNewUser();
}

/**
 * Sync all users with access_level 0 to the pending-users.json file
 */
export async function syncNewUser(): Promise<void> {
  try {
    // Get all users with access_level 0
    const pendingUsers = await db.all<User>(
      'SELECT id, email, name, created_at FROM users WHERE access_level = 0'
    );

    // Transform to pending user format
    const pendingUsersList: PendingUser[] = pendingUsers.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      created_at: user.created_at,
    }));

    // Write to file
    await fs.writeFile(
      PENDING_USERS_FILE,
      JSON.stringify(pendingUsersList, null, 2),
      'utf-8'
    );

    console.log(`Synced ${pendingUsersList.length} pending user(s) to pending-users.json`);
  } catch (error) {
    console.error('Error syncing pending users:', error);
    throw error;
  }
}

/**
 * Update a user's access level
 */
export async function updateUserAccessLevel(userId: number, accessLevel: number): Promise<void> {
  try {
    await db.run(
      'UPDATE users SET access_level = ?, updated_at = unixepoch() WHERE id = ?',
      [accessLevel, userId]
    );

    // Resync after update
    await syncNewUser();

    console.log(`Updated user ${userId} access level to ${accessLevel}`);
  } catch (error) {
    console.error('Error updating user access level:', error);
    throw error;
  }
}
