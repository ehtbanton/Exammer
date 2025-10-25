/**
 * Database Migration Script
 *
 * This script migrates older database versions to the current schema.
 * Run this script if you're experiencing issues with the database schema.
 *
 * Usage:
 *   npm run migrate-db
 *   OR
 *   npx ts-node scripts/migrate-database.ts
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'db', 'erudate.db');

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: any;
  pk: number;
}

class DatabaseMigration {
  private db: sqlite3.Database;

  constructor(dbPath: string) {
    if (!fs.existsSync(dbPath)) {
      console.error(`Database file not found at: ${dbPath}`);
      console.error('Please ensure the database exists before running migrations.');
      process.exit(1);
    }

    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        process.exit(1);
      }
      console.log(`Connected to database at: ${dbPath}`);
    });
  }

  private all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  private run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  async migrate() {
    console.log('\n=== Starting Database Migration ===\n');

    try {
      await this.migrateToV2();

      console.log('\n=== All Migrations Completed Successfully ===\n');
      this.close();
    } catch (error) {
      console.error('\n=== Migration Failed ===');
      console.error(error);
      this.close();
      process.exit(1);
    }
  }

  /**
   * Migration to V2: Add is_public column to subjects table
   */
  private async migrateToV2() {
    console.log('Migration V2: Adding public subject support...');

    // Check current schema
    const columns = await this.all<ColumnInfo>('PRAGMA table_info(subjects)');
    const hasIsPublic = columns.some(col => col.name === 'is_public');

    if (hasIsPublic) {
      console.log('✓ is_public column already exists - skipping');
      return;
    }

    console.log('Current subjects table columns:', columns.map(c => c.name).join(', '));

    // Backup subjects table
    console.log('\nCreating backup of subjects table...');
    const subjects = await this.all('SELECT * FROM subjects');
    console.log(`✓ Backed up ${subjects.length} subjects`);

    // Add the new column
    console.log('\nAdding is_public column to subjects table...');
    await this.run('ALTER TABLE subjects ADD COLUMN is_public INTEGER DEFAULT 0');
    console.log('✓ Added is_public column');

    // Create index
    console.log('Creating index on is_public column...');
    await this.run('CREATE INDEX IF NOT EXISTS idx_subjects_is_public ON subjects(is_public)');
    console.log('✓ Created index');

    // Verify the migration
    const updatedColumns = await this.all<ColumnInfo>('PRAGMA table_info(subjects)');
    const verified = updatedColumns.some(col => col.name === 'is_public');

    if (!verified) {
      throw new Error('Migration verification failed: is_public column not found after migration');
    }

    console.log('✓ Migration verified');
    console.log('Updated subjects table columns:', updatedColumns.map(c => c.name).join(', '));

    // Verify data integrity
    const subjectsAfter = await this.all('SELECT COUNT(*) as count FROM subjects');
    if ((subjectsAfter[0] as any).count !== subjects.length) {
      throw new Error('Data integrity check failed: subject count mismatch');
    }

    console.log('✓ Data integrity verified');
    console.log('\nMigration V2 completed successfully!\n');
  }

  close() {
    this.db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database connection closed');
      }
    });
  }
}

// Run the migration
const migration = new DatabaseMigration(DB_PATH);
migration.migrate();
