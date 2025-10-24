import { db } from './index';

/**
 * Migration to add access_level column to users table
 * Run this once to update existing databases
 */
export async function migrateAccessLevel() {
  try {
    // Check if column already exists
    const tableInfo = await db.all<{ name: string }>(
      "PRAGMA table_info(users)"
    );

    const hasAccessLevel = tableInfo.some(col => col.name === 'access_level');

    if (hasAccessLevel) {
      console.log('access_level column already exists');
      return;
    }

    // Add access_level column with default value 0
    await db.run('ALTER TABLE users ADD COLUMN access_level INTEGER DEFAULT 0');
    console.log('Successfully added access_level column to users table');
  } catch (error) {
    console.error('Error migrating access_level:', error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateAccessLevel()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
