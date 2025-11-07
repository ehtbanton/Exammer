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

const DB_PATH = path.join(process.cwd(), 'db', 'exammer.db');

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
      await this.migrateToV3();

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

  /**
   * Migration to V3: Add teacher-student class system
   */
  private async migrateToV3() {
    console.log('Migration V3: Adding teacher-student class system...');

    // Check if classes table already exists
    const tables = await this.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='classes'"
    );

    if (tables.length > 0) {
      console.log('✓ Classes table already exists - skipping V3 migration');
      return;
    }

    // Add class_id column to subjects table
    console.log('\n1. Adding class_id column to subjects table...');
    await this.run('ALTER TABLE subjects ADD COLUMN class_id INTEGER DEFAULT NULL');
    await this.run('CREATE INDEX IF NOT EXISTS idx_subjects_class_id ON subjects(class_id)');
    console.log('✓ Added class_id column to subjects');

    // Create classes table
    console.log('\n2. Creating classes table...');
    await this.run(`
      CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        teacher_id INTEGER NOT NULL,
        classroom_code TEXT UNIQUE NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    await this.run('CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON classes(teacher_id)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_classes_classroom_code ON classes(classroom_code)');
    console.log('✓ Created classes table with indexes');

    // Create class_memberships table
    console.log('\n3. Creating class_memberships table...');
    await this.run(`
      CREATE TABLE IF NOT EXISTS class_memberships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('teacher', 'student')),
        status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
        joined_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(class_id, user_id)
      )
    `);
    await this.run('CREATE INDEX IF NOT EXISTS idx_class_memberships_class_id ON class_memberships(class_id)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_class_memberships_user_id ON class_memberships(user_id)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_class_memberships_status ON class_memberships(status)');
    console.log('✓ Created class_memberships table with indexes');

    // Create class_subjects table
    console.log('\n4. Creating class_subjects table...');
    await this.run(`
      CREATE TABLE IF NOT EXISTS class_subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER NOT NULL,
        subject_id INTEGER NOT NULL,
        added_by_user_id INTEGER NOT NULL,
        added_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
        FOREIGN KEY (added_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(class_id, subject_id)
      )
    `);
    await this.run('CREATE INDEX IF NOT EXISTS idx_class_subjects_class_id ON class_subjects(class_id)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_class_subjects_subject_id ON class_subjects(subject_id)');
    console.log('✓ Created class_subjects table with indexes');

    // Verify all tables were created
    console.log('\n5. Verifying migration...');
    const verifyTables = await this.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('classes', 'class_memberships', 'class_subjects')"
    );

    if (verifyTables.length !== 3) {
      throw new Error('Migration verification failed: not all tables were created');
    }

    // Verify subjects table has class_id column
    const subjectColumns = await this.all<ColumnInfo>('PRAGMA table_info(subjects)');
    const hasClassId = subjectColumns.some(col => col.name === 'class_id');

    if (!hasClassId) {
      throw new Error('Migration verification failed: class_id column not found in subjects table');
    }

    console.log('✓ All tables and columns verified');
    console.log('\nMigration V3 completed successfully!\n');
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
