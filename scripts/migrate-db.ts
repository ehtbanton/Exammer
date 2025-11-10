#!/usr/bin/env tsx

/**
 * CLI script to run database migrations
 *
 * Usage:
 *   npm run migrate
 *   OR
 *   tsx scripts/migrate-db.ts
 */

import { migratePaperTypeArchitecture } from '../src/lib/db/migrate-paper-types';

async function main() {
  console.log('='.repeat(60));
  console.log('Database Migration Tool');
  console.log('='.repeat(60));
  console.log();

  try {
    await migratePaperTypeArchitecture();

    console.log();
    console.log('='.repeat(60));
    console.log('All migrations completed successfully!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error();
    console.error('='.repeat(60));
    console.error('Migration failed with error:');
    console.error(error);
    console.error('='.repeat(60));
    process.exit(1);
  }
}

main();
