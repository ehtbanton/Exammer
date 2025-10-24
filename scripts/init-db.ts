/**
 * Database Initialization Script
 *
 * Run this script to initialize the database schema:
 * npx tsx scripts/init-db.ts
 */

import { db } from '../src/lib/db';

async function initDatabase() {
  console.log('Database initialization complete!');
  console.log('The database schema has been created automatically on first connection.');
  console.log('Database location: erudate.db');

  // Test the connection
  try {
    const result = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM users');
    console.log(`Current user count: ${result?.count || 0}`);
    process.exit(0);
  } catch (error) {
    console.error('Error testing database:', error);
    process.exit(1);
  }
}

initDatabase();
