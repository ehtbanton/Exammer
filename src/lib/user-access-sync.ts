import { db, User } from './db';
import fs from 'fs';
import path from 'path';
import { watch } from 'fs';

const PENDING_USERS_FILE = path.join(process.cwd(), 'pending-users.json');

interface PendingUser {
  id: number;
  username: string | null;
  email: string;
  access: number;
  created_at: string;
}

/**
 * Sync users from database to pending-users.json
 * This adds any new users and updates the file
 */
export async function syncUsersToFile(): Promise<void> {
  try {
    // Get all users from database
    const users = await db.all<User>('SELECT * FROM users ORDER BY created_at DESC');

    // Read existing file
    let existingUsers: PendingUser[] = [];
    if (fs.existsSync(PENDING_USERS_FILE)) {
      const fileContent = fs.readFileSync(PENDING_USERS_FILE, 'utf-8');
      existingUsers = JSON.parse(fileContent);
    }

    // Create a map of existing users by email for quick lookup
    const existingUserMap = new Map(existingUsers.map(u => [u.email, u]));

    // Build the updated users array
    const updatedUsers: PendingUser[] = users.map(user => {
      const existing = existingUserMap.get(user.email);
      const createdDate = new Date(user.created_at * 1000);
      const formattedDate = createdDate.toISOString().slice(0, 19).replace('T', ' ');

      // If user exists in file, preserve their access level from file
      // Otherwise use the access level from database
      return {
        id: user.id,
        username: user.name || null,
        email: user.email,
        access: existing ? existing.access : user.access_level,
        created_at: existing ? existing.created_at : formattedDate
      };
    });

    // Write updated users to file
    fs.writeFileSync(
      PENDING_USERS_FILE,
      JSON.stringify(updatedUsers, null, 2),
      'utf-8'
    );

    console.log('Synced users to pending-users.json');
  } catch (error) {
    console.error('Error syncing users to file:', error);
    throw error;
  }
}

/**
 * Sync access levels from pending-users.json back to database
 * This reads the file and updates database access levels
 */
export async function syncAccessLevelsFromFile(): Promise<void> {
  try {
    if (!fs.existsSync(PENDING_USERS_FILE)) {
      console.log('pending-users.json does not exist yet');
      return;
    }

    // Read the file
    const fileContent = fs.readFileSync(PENDING_USERS_FILE, 'utf-8');
    const pendingUsers: PendingUser[] = JSON.parse(fileContent);

    // Update each user's access level in the database
    for (const user of pendingUsers) {
      await db.run(
        'UPDATE users SET access_level = ? WHERE id = ?',
        [user.access, user.id]
      );
    }

    console.log('Synced access levels from pending-users.json to database');
  } catch (error) {
    console.error('Error syncing access levels from file:', error);
    throw error;
  }
}

/**
 * Watch the pending-users.json file for changes and sync to database
 */
export function watchPendingUsersFile(): void {
  if (!fs.existsSync(PENDING_USERS_FILE)) {
    console.log('pending-users.json does not exist, skipping file watch');
    return;
  }

  console.log('Watching pending-users.json for changes...');

  let debounceTimer: NodeJS.Timeout;

  watch(PENDING_USERS_FILE, (eventType) => {
    if (eventType === 'change') {
      // Debounce to avoid multiple rapid updates
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        console.log('pending-users.json changed, syncing access levels...');
        try {
          await syncAccessLevelsFromFile();
        } catch (error) {
          console.error('Error during file watch sync:', error);
        }
      }, 500);
    }
  });
}

/**
 * Initialize the sync system
 * 1. Sync current users to file
 * 2. Sync access levels from file to database
 * 3. Start watching the file for changes
 */
export async function initializeUserAccessSync(): Promise<void> {
  try {
    // First sync users to file
    await syncUsersToFile();

    // Then sync access levels from file to database (in case file was manually edited)
    await syncAccessLevelsFromFile();

    // Start watching for future changes
    watchPendingUsersFile();

    console.log('User access sync system initialized');
  } catch (error) {
    console.error('Error initializing user access sync:', error);
    throw error;
  }
}

/**
 * Periodic sync to ensure new signups are added to the file
 * Call this after new user signups
 */
export async function syncNewUser(): Promise<void> {
  await syncUsersToFile();
}
