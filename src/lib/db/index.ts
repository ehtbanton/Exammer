import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

// Database path - in /db folder
const DB_PATH = path.join(process.cwd(), 'db', 'exammer.db');

// Create a connection pool-like wrapper
class Database {
  private db: sqlite3.Database | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      console.log('Starting database initialization...');

      // First, ensure schema file is applied (creates tables with IF NOT EXISTS)
      await this.applyBaseSchema();

      // Then run versioned migrations
      await this.runVersionedMigrations();

      // Finally, initialize user access sync
      await this.initializeUserAccessSync();

      console.log('Database initialization completed successfully');
    } catch (error) {
      console.error('CRITICAL: Database initialization failed:', error);
      throw error;
    }
  }

  private applyBaseSchema(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, async (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
          return;
        }

        console.log('Connected to SQLite database at', DB_PATH);

        // Configure SQLite for better write durability
        this.db!.run('PRAGMA journal_mode = DELETE', (err) => {
          if (err) {
            console.error('Error setting journal mode:', err);
          }
        });

        this.db!.run('PRAGMA synchronous = FULL', (err) => {
          if (err) {
            console.error('Error setting synchronous mode:', err);
          }
        });

        const schemaPath = path.join(process.cwd(), 'src', 'lib', 'db', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        this.db!.exec(schema, (err) => {
          if (err) {
            console.error('Error applying base schema:', err);
            reject(err);
          } else {
            console.log('Base schema applied successfully');
            resolve();
          }
        });
      });
    });
  }

  private async runVersionedMigrations(): Promise<void> {
    // Skip migrations if disabled via environment variable
    if (process.env.SKIP_DB_MIGRATIONS === 'true') {
      console.log('Database migrations skipped (SKIP_DB_MIGRATIONS=true)');
      return;
    }

    try {
      const { runMigrations } = await import('../../../db/migrate');

      // Close current connection before migration
      if (this.db) {
        await new Promise<void>((resolve, reject) => {
          this.db!.close((err) => {
            if (err) reject(err);
            else {
              this.db = null;
              resolve();
            }
          });
        });
      }

      // Run migrations
      await runMigrations();

      // Reopen connection
      await new Promise<void>((resolve, reject) => {
        this.db = new sqlite3.Database(DB_PATH, (err) => {
          if (err) {
            console.error('Error reopening database after migration:', err);
            reject(err);
          } else {
            // Configure SQLite for better write durability
            this.db!.run('PRAGMA journal_mode = DELETE', () => {});
            this.db!.run('PRAGMA synchronous = FULL', () => {});
            console.log('Database reconnected after migration');
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Error running versioned migrations:', error);
      throw error;
    }
  }

  private async initializeUserAccessSync(): Promise<void> {
    try {
      const { initializeUserAccessSync } = await import('../user-access-sync');
      // Run user access sync initialization in the background without blocking
      initializeUserAccessSync().then(() => {
        console.log('User access sync initialized');
      }).catch((error) => {
        console.error('Error initializing user access sync (non-blocking):', error);
      });
      // Don't wait for it to complete
    } catch (error) {
      console.error('Error importing user access sync:', error);
      // Don't throw - user sync is not critical for database operations
    }
  }

  // Wait for initialization to complete
  async ready(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
    if (!this.db) {
      throw new Error('Database connection is not available after initialization');
    }
  }

  // Run a query that returns multiple rows
  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    await this.ready();
    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  // Run a query that returns a single row
  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    await this.ready();
    return new Promise((resolve, reject) => {
      this.db!.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T | undefined);
      });
    });
  }

  // Run a query that doesn't return rows (INSERT, UPDATE, DELETE)
  async run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    await this.ready();
    return new Promise((resolve, reject) => {
      this.db!.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  // Close the database connection
  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) reject(err);
          else {
            this.db = null;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

// Export a singleton instance
export const db = new Database();

// Helper type definitions
export interface User {
  id: number;
  email: string;
  password_hash?: string;
  name?: string;
  email_verified: number;
  access_level: number;
  image?: string;
  created_at: number;
  updated_at: number;
}

export interface Account {
  id: number;
  user_id: number;
  type: string;
  provider: string;
  provider_account_id: string;
  refresh_token?: string;
  access_token?: string;
  expires_at?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
  session_state?: string;
}

export interface Session {
  id: number;
  session_token: string;
  user_id: number;
  expires: number;
}

export interface VerificationToken {
  identifier: string;
  token: string;
  expires: number;
}

export interface Subject {
  id: number;
  name: string;
  syllabus_content?: string;
  created_at: number;
  updated_at: number;
}

export interface UserWorkspace {
  id: number;
  user_id: number;
  subject_id: number;
  is_creator: number;
  added_at: number;
}

export interface PastPaper {
  id: number;
  subject_id: number;
  name: string;
  content: string;
  created_at: number;
}

export interface PaperType {
  id: number;
  subject_id: number;
  name: string;
  created_at: number;
}

export interface Topic {
  id: number;
  paper_type_id: number;
  name: string;
  description?: string;
  created_at: number;
}

export interface Question {
  id: number;
  topic_id: number;
  question_text: string;
  summary: string;
  created_at: number;
}

export interface UserProgress {
  id: number;
  user_id: number;
  question_id: number;
  score: number;
  attempts: number;
  score_history: string; // JSON array of last 3 scores (out of 10)
  updated_at: number;
}
