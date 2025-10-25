/**
 * Test Migration Script
 *
 * This script verifies that the database migration has been applied correctly.
 * It checks for the presence of required columns and indexes.
 *
 * Usage:
 *   npm run test:migration
 *   OR
 *   npx ts-node scripts/test-migration.ts
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

interface IndexInfo {
  seq: number;
  name: string;
  unique: number;
  origin: string;
  partial: number;
}

class MigrationTest {
  private db: sqlite3.Database;
  private passed = 0;
  private failed = 0;

  constructor(dbPath: string) {
    if (!fs.existsSync(dbPath)) {
      console.error(`❌ Database file not found at: ${dbPath}`);
      process.exit(1);
    }

    this.db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        console.error('❌ Error opening database:', err);
        process.exit(1);
      }
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

  private test(name: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`✅ ${name}`);
      this.passed++;
    } else {
      console.log(`❌ ${name}`);
      if (details) console.log(`   ${details}`);
      this.failed++;
    }
  }

  async runTests() {
    console.log('\n=== Database Migration Test ===\n');
    console.log(`Testing database: ${DB_PATH}\n`);

    try {
      await this.testSubjectsTable();
      await this.testIndexes();
      await this.testDataIntegrity();

      this.printSummary();
      this.close();

      if (this.failed > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error('\n❌ Test execution failed:', error);
      this.close();
      process.exit(1);
    }
  }

  private async testSubjectsTable() {
    console.log('Testing subjects table schema...\n');

    const columns = await this.all<ColumnInfo>('PRAGMA table_info(subjects)');
    const columnNames = columns.map(c => c.name);

    // Test required columns exist
    this.test(
      'subjects table has id column',
      columnNames.includes('id')
    );

    this.test(
      'subjects table has user_id column',
      columnNames.includes('user_id')
    );

    this.test(
      'subjects table has name column',
      columnNames.includes('name')
    );

    this.test(
      'subjects table has is_public column (V2 migration)',
      columnNames.includes('is_public'),
      'Run migration: npm run migrate:db'
    );

    this.test(
      'subjects table has syllabus_content column',
      columnNames.includes('syllabus_content')
    );

    this.test(
      'subjects table has created_at column',
      columnNames.includes('created_at')
    );

    this.test(
      'subjects table has updated_at column',
      columnNames.includes('updated_at')
    );

    // Test is_public column properties
    const isPublicCol = columns.find(c => c.name === 'is_public');
    if (isPublicCol) {
      this.test(
        'is_public column has correct type (INTEGER)',
        isPublicCol.type === 'INTEGER'
      );

      this.test(
        'is_public column has default value',
        isPublicCol.dflt_value !== null,
        `Default value: ${isPublicCol.dflt_value}`
      );
    }

    console.log();
  }

  private async testIndexes() {
    console.log('Testing database indexes...\n');

    const indexes = await this.all<IndexInfo>('PRAGMA index_list(subjects)');
    const indexNames = indexes.map(i => i.name);

    this.test(
      'subjects table has idx_subjects_user_id index',
      indexNames.includes('idx_subjects_user_id')
    );

    this.test(
      'subjects table has idx_subjects_is_public index (V2 migration)',
      indexNames.includes('idx_subjects_is_public'),
      'Run migration: npm run migrate:db'
    );

    console.log();
  }

  private async testDataIntegrity() {
    console.log('Testing data integrity...\n');

    // Check if database is readable
    const subjects = await this.all('SELECT COUNT(*) as count FROM subjects');
    const count = (subjects[0] as any).count;

    this.test(
      'Database is readable and subjects table is accessible',
      count >= 0,
      `Found ${count} subjects`
    );

    // Check if is_public values are valid
    if (count > 0) {
      const invalidPublic = await this.all(
        'SELECT COUNT(*) as count FROM subjects WHERE is_public NOT IN (0, 1)'
      );
      const invalidCount = (invalidPublic[0] as any).count;

      this.test(
        'All subjects have valid is_public values (0 or 1)',
        invalidCount === 0,
        invalidCount > 0 ? `Found ${invalidCount} invalid values` : undefined
      );
    }

    // Run integrity check
    const integrity = await this.all('PRAGMA integrity_check');
    const isIntact = (integrity[0] as any).integrity_check === 'ok';

    this.test(
      'Database integrity check passed',
      isIntact,
      isIntact ? undefined : 'Database may be corrupted'
    );

    console.log();
  }

  private printSummary() {
    console.log('=== Test Summary ===\n');
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`Total: ${this.passed + this.failed}\n`);

    if (this.failed === 0) {
      console.log('🎉 All tests passed! Database migration is complete.\n');
    } else {
      console.log('⚠️  Some tests failed. Please run the migration:');
      console.log('   npm run migrate:db\n');
    }
  }

  close() {
    this.db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      }
    });
  }
}

// Run the tests
const test = new MigrationTest(DB_PATH);
test.runTests();
