/**
 * Donations Table Migration - Add Orders API Support
 *
 * This script adds columns to support PayPal Orders API instead of Invoicing API.
 *
 * Usage:
 *   npx ts-node scripts/migrate-donations-orders.ts
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

class DonationsOrdersMigration {
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
    console.log('\n=== Starting Donations Orders API Migration ===\n');

    try {
      // Check current schema
      const columns = await this.all<ColumnInfo>('PRAGMA table_info(donations)');
      const hasOrderId = columns.some(col => col.name === 'paypal_order_id');
      const hasCaptureId = columns.some(col => col.name === 'payment_capture_id');

      if (hasOrderId && hasCaptureId) {
        console.log('✓ Orders API columns already exist - skipping migration');
        this.close();
        return;
      }

      console.log('Current donations table columns:', columns.map(c => c.name).join(', '));

      // Add paypal_order_id column if it doesn't exist
      if (!hasOrderId) {
        console.log('\nAdding paypal_order_id column...');
        await this.run('ALTER TABLE donations ADD COLUMN paypal_order_id TEXT');
        console.log('✓ Added paypal_order_id column');
      }

      // Add payment_capture_id column if it doesn't exist
      if (!hasCaptureId) {
        console.log('Adding payment_capture_id column...');
        await this.run('ALTER TABLE donations ADD COLUMN payment_capture_id TEXT');
        console.log('✓ Added payment_capture_id column');
      }

      // Create index on paypal_order_id
      console.log('Creating index on paypal_order_id...');
      await this.run('CREATE INDEX IF NOT EXISTS idx_donations_order_id ON donations(paypal_order_id)');
      console.log('✓ Created idx_donations_order_id');

      // Verify the migration
      const updatedColumns = await this.all<ColumnInfo>('PRAGMA table_info(donations)');
      const verified = updatedColumns.some(col => col.name === 'paypal_order_id') &&
                      updatedColumns.some(col => col.name === 'payment_capture_id');

      if (!verified) {
        throw new Error('Migration verification failed: columns not found after migration');
      }

      console.log('✓ Migration verified');
      console.log('Updated donations table columns:', updatedColumns.map(c => c.name).join(', '));

      console.log('\n=== Donations Orders API Migration Completed Successfully ===\n');

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
const migration = new DonationsOrdersMigration(DB_PATH);
migration.migrate();
