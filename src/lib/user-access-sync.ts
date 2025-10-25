import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { db } from './db';
import type { User } from './db';

const USERS_FILE = path.join(process.cwd(), 'db', 'users.json');

interface UserData {
  id: number;
  email: string;
  name?: string | null;
  access_level: number;
  created_at: string; // Human-readable format
}

let isWatching = false;
let isSyncing = false;

// Event emitter for user changes
type UserChangeListener = (userId?: number) => void;
const userChangeListeners = new Set<UserChangeListener>();

export function onUserChange(listener: UserChangeListener) {
  userChangeListeners.add(listener);
  return () => userChangeListeners.delete(listener);
}

function notifyUserChange(userId?: number) {
  userChangeListeners.forEach(listener => listener(userId));
}

/**
 * Format Unix timestamp to readable date/time
 */
function formatTimestamp(unixTimestamp: number): string {
  const date = new Date(unixTimestamp * 1000);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * Sync database users to users.json file
 */
export async function syncDatabaseToFile(): Promise<void> {
  if (isSyncing) return;
  isSyncing = true;

  try {
    // Get all users from database
    const users = await db.all<User>(
      'SELECT id, email, name, access_level, created_at FROM users ORDER BY created_at DESC'
    );

    // Transform to user data format with readable timestamps
    const usersList: UserData[] = users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      access_level: user.access_level,
      created_at: formatTimestamp(user.created_at),
    }));

    // Write to file
    await fs.writeFile(
      USERS_FILE,
      JSON.stringify(usersList, null, 2),
      'utf-8'
    );

    console.log(`Synced ${usersList.length} user(s) to users.json`);
  } catch (error) {
    console.error('Error syncing database to file:', error);
  } finally {
    isSyncing = false;
  }
}

/**
 * Sync users.json file changes to database
 */
async function syncFileToDatabase(): Promise<void> {
  if (isSyncing) return;
  isSyncing = true;

  try {
    // Read the file
    const fileContent = await fs.readFile(USERS_FILE, 'utf-8');

    // Parse JSON
    let fileUsers: UserData[];
    try {
      fileUsers = JSON.parse(fileContent);
    } catch (parseError) {
      console.error('Invalid JSON in users.json, reverting to database state');
      await syncDatabaseToFile();
      return;
    }

    // Validate structure
    if (!Array.isArray(fileUsers)) {
      console.error('users.json must be an array, reverting to database state');
      await syncDatabaseToFile();
      return;
    }

    // Get current users from database
    const dbUsers = await db.all<User>(
      'SELECT id, email, name, access_level FROM users'
    );

    const dbUsersMap = new Map(dbUsers.map(u => [u.id, u]));
    const fileUsersMap = new Map(fileUsers.map(u => [u.id, u]));

    // Track affected user IDs for session invalidation
    const affectedUserIds: number[] = [];

    // Check for deleted users (in DB but not in file)
    for (const dbUser of dbUsers) {
      if (!fileUsersMap.has(dbUser.id)) {
        console.log(`Deleting user ${dbUser.id} (${dbUser.email})`);
        await db.run('DELETE FROM users WHERE id = ?', [dbUser.id]);
        // Clean up related data
        await db.run('DELETE FROM sessions WHERE user_id = ?', [dbUser.id]);
        await db.run('DELETE FROM accounts WHERE user_id = ?', [dbUser.id]);
        affectedUserIds.push(dbUser.id);
      }
    }

    // Check for updates
    for (const fileUser of fileUsers) {
      const dbUser = dbUsersMap.get(fileUser.id);

      if (!dbUser) {
        console.log(`User ${fileUser.id} in file but not in database, skipping`);
        continue;
      }

      // Check if access_level changed
      if (dbUser.access_level !== fileUser.access_level) {
        console.log(`Updating user ${fileUser.id} (${fileUser.email}) access_level from ${dbUser.access_level} to ${fileUser.access_level}`);
        await db.run(
          'UPDATE users SET access_level = ?, updated_at = unixepoch() WHERE id = ?',
          [fileUser.access_level, fileUser.id]
        );
        affectedUserIds.push(fileUser.id);
      }

      // Check if name changed
      if (dbUser.name !== fileUser.name) {
        console.log(`Updating user ${fileUser.id} (${fileUser.email}) name from "${dbUser.name}" to "${fileUser.name}"`);
        await db.run(
          'UPDATE users SET name = ?, updated_at = unixepoch() WHERE id = ?',
          [fileUser.name || null, fileUser.id]
        );
      }
    }

    // If there were changes, invalidate affected sessions
    if (affectedUserIds.length > 0) {
      console.log(`Invalidating sessions for users: ${affectedUserIds.join(', ')}`);
      for (const userId of affectedUserIds) {
        await db.run('DELETE FROM sessions WHERE user_id = ?', [userId]);
      }

      // Notify listeners about user changes
      affectedUserIds.forEach(userId => notifyUserChange(userId));
    }

    // Sync back to file to ensure consistency (only if there were changes)
    if (dbUsers.length !== fileUsers.length || affectedUserIds.length > 0) {
      await syncDatabaseToFile();
    }

  } catch (error) {
    console.error('Error syncing file to database:', error);
  } finally {
    isSyncing = false;
  }
}

/**
 * Start watching users.json for changes
 */
function startFileWatcher(): void {
  if (isWatching) return;
  isWatching = true;

  let debounceTimeout: NodeJS.Timeout | null = null;

  try {
    console.log('Starting file watcher for users.json');

    fsSync.watch(USERS_FILE, async (eventType) => {
      if (eventType === 'change') {
        // Debounce to avoid multiple rapid calls
        if (debounceTimeout) {
          clearTimeout(debounceTimeout);
        }
        debounceTimeout = setTimeout(async () => {
          console.log('users.json changed, syncing to database...');
          await syncFileToDatabase();
        }, 250);
      }
    });
  } catch (error) {
    console.error('Error starting file watcher:', error);
    isWatching = false;
  }
}

/**
 * Initialize the user sync system
 */
export async function initializeUserAccessSync(): Promise<void> {
  try {
    // Check if the file exists
    try {
      await fs.access(USERS_FILE);
    } catch {
      // File doesn't exist, create it
      await fs.writeFile(USERS_FILE, JSON.stringify([], null, 2), 'utf-8');
      console.log('Created users.json file');
    }

    // Sync database to file initially
    await syncDatabaseToFile();

    // Start watching for file changes
    startFileWatcher();

  } catch (error) {
    console.error('Error initializing user sync system:', error);
  }
}

/**
 * Sync new user (called after user creation)
 */
export async function syncNewUser(): Promise<void> {
  await syncDatabaseToFile();
}

/**
 * Update a user's access level (legacy function, now handled by file editing)
 */
export async function updateUserAccessLevel(userId: number, accessLevel: number): Promise<void> {
  try {
    await db.run(
      'UPDATE users SET access_level = ?, updated_at = unixepoch() WHERE id = ?',
      [accessLevel, userId]
    );

    // Invalidate their session
    await db.run('DELETE FROM sessions WHERE user_id = ?', [userId]);

    await syncDatabaseToFile();

    console.log(`Updated user ${userId} access level to ${accessLevel}`);
  } catch (error) {
    console.error('Error updating user access level:', error);
    throw error;
  }
}
