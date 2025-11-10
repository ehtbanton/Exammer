/**
 * Database Inspection and Revert Script
 * Checks current database state and can revert to version 4
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'db', 'exammer.db');
const BACKUP_PATH = path.join(process.cwd(), 'db', 'exammer.backup.db');

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

class DatabaseInspector {
  private db: sqlite3.Database;

  constructor(dbPath: string) {
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
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

  private run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async inspectDatabase() {
    console.log('\n=== DATABASE INSPECTION ===\n');

    // Check current version
    try {
      const version = await this.all('SELECT version FROM db_version ORDER BY id DESC LIMIT 1');
      console.log('Current DB Version:', version[0] || 'No version found');
    } catch (err) {
      console.log('Current DB Version: Table not found');
    }

    // Check if version 5 tables exist
    const tables = await this.all<TableInfo>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('classes', 'class_memberships', 'class_subjects')"
    );
    console.log('\nVersion 5 tables present:', tables.map(t => t.name).join(', ') || 'None');

    // Check subjects table schema
    const columns = await this.all<ColumnInfo>('PRAGMA table_info(subjects)');
    console.log('\nSubjects table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.name} (${col.type})`);
    });

    const hasClassId = columns.some(c => c.name === 'class_id');
    const hasDiagramMermaid = columns.some(c => c.name === 'diagram_mermaid');

    console.log('\nVersion indicators:');
    console.log('  - Has class_id column (v5):', hasClassId);
    console.log('  - Has diagram_mermaid column (v6):', hasDiagramMermaid);

    // Check questions table schema
    const questionsColumns = await this.all<ColumnInfo>('PRAGMA table_info(questions)');
    console.log('\nQuestions table columns:');
    questionsColumns.forEach(col => {
      console.log(`  - ${col.name} (${col.type})`);
    });
  }

  async revertToVersion4() {
    console.log('\n=== REVERTING TO VERSION 4 ===\n');

    // Create backup first
    console.log('Creating backup...');
    await this.close();
    fs.copyFileSync(DB_PATH, BACKUP_PATH);
    console.log(`✓ Backup created at: ${BACKUP_PATH}`);

    // Reopen database
    this.db = new sqlite3.Database(DB_PATH);

    try {
      await this.run('BEGIN TRANSACTION');

      // Drop version 5 tables if they exist
      console.log('Removing version 5 tables...');
      await this.run('DROP TABLE IF EXISTS class_subjects');
      await this.run('DROP TABLE IF EXISTS class_memberships');
      await this.run('DROP TABLE IF EXISTS classes');
      console.log('✓ Version 5 tables removed');

      // Check if subjects has class_id column
      const columns = await this.all<ColumnInfo>('PRAGMA table_info(subjects)');
      const hasClassId = columns.some(c => c.name === 'class_id');

      if (hasClassId) {
        console.log('Removing class_id column from subjects...');
        // SQLite doesn't support DROP COLUMN, so we need to recreate the table
        const subjects = await this.all('SELECT * FROM subjects');

        await this.run(`
          CREATE TABLE subjects_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            syllabus_content TEXT,
            created_at INTEGER DEFAULT (unixepoch()),
            updated_at INTEGER DEFAULT (unixepoch())
          )
        `);

        for (const subject of subjects) {
          await this.run(
            'INSERT INTO subjects_new (id, name, syllabus_content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
            [subject.id, subject.name, subject.syllabus_content, subject.created_at, subject.updated_at]
          );
        }

        await this.run('DROP TABLE subjects');
        await this.run('ALTER TABLE subjects_new RENAME TO subjects');
        await this.run('CREATE INDEX IF NOT EXISTS idx_subjects_name ON subjects(name)');
        console.log('✓ class_id column removed');
      }

      // Set version to 4
      await this.run('DELETE FROM db_version WHERE version > 4');
      console.log('✓ Version set to 4');

      await this.run('COMMIT');
      console.log('\n✓ Successfully reverted to version 4');
      console.log('✓ Backup available at:', BACKUP_PATH);
    } catch (error) {
      await this.run('ROLLBACK');
      console.error('\n✗ Revert failed:', error);
      throw error;
    }
  }

  async close() {
    return new Promise<void>((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

// Main execution
const inspector = new DatabaseInspector(DB_PATH);

const args = process.argv.slice(2);
const shouldRevert = args.includes('--revert');

(async () => {
  try {
    await inspector.inspectDatabase();

    if (shouldRevert) {
      // Auto-confirm for automated execution
      console.log('\nProceeding with revert to version 4...');
      await inspector.revertToVersion4();
      await inspector.close();
    } else {
      console.log('\nTo revert to version 4, run: npm run inspect-db -- --revert');
      await inspector.close();
    }
  } catch (error) {
    console.error('Error:', error);
    await inspector.close();
    process.exit(1);
  }
})();
