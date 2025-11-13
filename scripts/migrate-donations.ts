/**
 * Donations Table Migration Script
 *
 * This script adds the donations table to support PayPal donation functionality.
 *
 * Usage:
 *   npx ts-node scripts/migrate-donations.ts
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'db', 'exammer.db');

interface TableInfo {
  type: string;
  name: string;
  tbl_name: string;
  rootpage: number;
  sql: string | null;
}

class DonationsMigration {
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
    console.log('\n=== Starting Donations Table Migration ===\n');

    try {
      // Check if donations table already exists
      const tables = await this.all<TableInfo>(
        "SELECT * FROM sqlite_master WHERE type='table' AND name='donations'"
      );

      if (tables.length > 0) {
        console.log('✓ Donations table already exists - skipping migration');
        this.close();
        return;
      }

      console.log('Creating donations table...');

      // Create donations table
      await this.run(`
        CREATE TABLE donations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          amount REAL NOT NULL,
          currency_code TEXT DEFAULT 'USD',
          donor_name TEXT,
          donor_email TEXT,
          donor_message TEXT,
          paypal_invoice_id TEXT,
          paypal_invoice_url TEXT,
          invoice_status TEXT DEFAULT 'DRAFT',
          created_at INTEGER DEFAULT (unixepoch()),
          updated_at INTEGER DEFAULT (unixepoch()),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
      `);
      console.log('✓ Created donations table');

      // Create indexes
      console.log('Creating indexes...');
      await this.run('CREATE INDEX idx_donations_user_id ON donations(user_id)');
      console.log('✓ Created idx_donations_user_id');

      await this.run('CREATE INDEX idx_donations_status ON donations(invoice_status)');
      console.log('✓ Created idx_donations_status');

      await this.run('CREATE INDEX idx_donations_created_at ON donations(created_at)');
      console.log('✓ Created idx_donations_created_at');

      // Verify the migration
      const verifyTables = await this.all<TableInfo>(
        "SELECT * FROM sqlite_master WHERE type='table' AND name='donations'"
      );

      if (verifyTables.length === 0) {
        throw new Error('Migration verification failed: donations table not found after migration');
      }

      console.log('✓ Migration verified');
      console.log('\n=== Donations Table Migration Completed Successfully ===\n');

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
const migration = new DonationsMigration(DB_PATH);
migration.migrate();
