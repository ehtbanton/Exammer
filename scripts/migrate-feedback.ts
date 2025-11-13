/**
 * Feedback System Migration
 *
 * This script creates tables for the user feedback system.
 *
 * Usage:
 *   npx ts-node scripts/migrate-feedback.ts
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

interface TableInfo {
  name: string;
}

class FeedbackMigration {
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
    console.log('\n=== Starting Feedback System Migration ===\n');

    try {
      // Check if tables already exist
      const tables = await this.all<TableInfo>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('feedback', 'feedback_notes', 'feedback_status_history')"
      );

      if (tables.length === 3) {
        console.log('✓ Feedback tables already exist - skipping migration');
        this.close();
        return;
      }

      // Create feedback table
      console.log('Creating feedback table...');
      await this.run(`
        CREATE TABLE IF NOT EXISTS feedback (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          category TEXT NOT NULL CHECK(category IN ('bug', 'feature', 'improvement', 'question', 'other')),
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          url TEXT,
          screenshot_url TEXT,
          browser_info TEXT,
          status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'in_progress', 'resolved', 'closed', 'archived')),
          priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
          created_at INTEGER DEFAULT (unixepoch()),
          updated_at INTEGER DEFAULT (unixepoch()),
          resolved_at INTEGER,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
      `);
      console.log('✓ Created feedback table');

      // Create feedback_notes table
      console.log('Creating feedback_notes table...');
      await this.run(`
        CREATE TABLE IF NOT EXISTS feedback_notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          feedback_id INTEGER NOT NULL,
          admin_user_id INTEGER NOT NULL,
          note TEXT NOT NULL,
          is_internal BOOLEAN DEFAULT 1,
          created_at INTEGER DEFAULT (unixepoch()),
          FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE,
          FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log('✓ Created feedback_notes table');

      // Create feedback_status_history table
      console.log('Creating feedback_status_history table...');
      await this.run(`
        CREATE TABLE IF NOT EXISTS feedback_status_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          feedback_id INTEGER NOT NULL,
          admin_user_id INTEGER,
          old_status TEXT,
          new_status TEXT NOT NULL,
          changed_at INTEGER DEFAULT (unixepoch()),
          FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE,
          FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL
        )
      `);
      console.log('✓ Created feedback_status_history table');

      // Create indexes
      console.log('Creating indexes...');

      await this.run('CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id)');
      console.log('✓ Created idx_feedback_user_id');

      await this.run('CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status)');
      console.log('✓ Created idx_feedback_status');

      await this.run('CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback(category)');
      console.log('✓ Created idx_feedback_category');

      await this.run('CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at)');
      console.log('✓ Created idx_feedback_created_at');

      await this.run('CREATE INDEX IF NOT EXISTS idx_feedback_notes_feedback_id ON feedback_notes(feedback_id)');
      console.log('✓ Created idx_feedback_notes_feedback_id');

      await this.run('CREATE INDEX IF NOT EXISTS idx_feedback_status_history_feedback_id ON feedback_status_history(feedback_id)');
      console.log('✓ Created idx_feedback_status_history_feedback_id');

      // Verify the migration
      const verifyTables = await this.all<TableInfo>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('feedback', 'feedback_notes', 'feedback_status_history')"
      );

      if (verifyTables.length !== 3) {
        throw new Error('Migration verification failed: not all tables were created');
      }

      console.log('✓ Migration verified');
      console.log('\n=== Feedback System Migration Completed Successfully ===\n');

      this.close();
    } catch (error) {
      console.error('\n=== Migration Failed ===');
      console.error(error);
      this.close();
      process.exit(1);
    }
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
const migration = new FeedbackMigration(DB_PATH);
migration.migrate();
