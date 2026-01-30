import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

// Database path - in /db folder
const DB_PATH = path.join(process.cwd(), 'db', 'exammer.db');

// Create a connection pool-like wrapper
class Database {
  private db: sqlite3.Database | null = null;
  private initPromise: Promise<void> | null = null;
  private initialized = false;

  constructor() {
    // Don't initialize immediately - wait for first query (lazy initialization)
  }

  private async initialize(): Promise<void> {
    // Prevent multiple initializations
    if (this.initialized || this.initPromise) {
      return this.initPromise || Promise.resolve();
    }

    this.initPromise = (async () => {
      try {
        console.log('Starting database initialization...');

        // Check if database exists
        const dbExists = fs.existsSync(DB_PATH);

        if (!dbExists) {
          // If database doesn't exist, let migrations handle creation
          console.log('Database does not exist, migrations will create it...');
        }

        // Run versioned migrations FIRST (will create database if needed, or migrate existing)
        // This must happen before any schema application to ensure columns exist
        await this.runVersionedMigrations();

        // Open database connection after migrations
        if (!this.db) {
          await new Promise<void>((resolve, reject) => {
            this.db = new sqlite3.Database(DB_PATH, (err) => {
              if (err) {
                console.error('Error opening database:', err);
                reject(err);
              } else {
                console.log('Connected to SQLite database at', DB_PATH);
                // Configure SQLite for better write durability
                this.db!.run('PRAGMA journal_mode = DELETE', () => {});
                this.db!.run('PRAGMA synchronous = FULL', () => {});
                resolve();
              }
            });
          });
        }

        // Finally, initialize user access sync
        await this.initializeUserAccessSync();

        this.initialized = true;
        console.log('Database initialization completed successfully');
      } catch (error) {
        console.error('CRITICAL: Database initialization failed:', error);
        this.initPromise = null; // Reset to allow retry
        throw error;
      }
    })();

    return this.initPromise;
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

  // Wait for initialization to complete (triggers lazy initialization on first call)
  async ready(): Promise<void> {
    if (!this.initialized && !this.initPromise) {
      // First time being called - trigger initialization
      await this.initialize();
    } else if (this.initPromise) {
      // Already initializing - wait for it
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
  field_classification?: string; // JSON: {field, subfield, level, keywords[]}
  created_at: number;
  updated_at: number;
}

export interface EnrichmentSuggestion {
  id: number;
  subject_id: number;
  type: 'gap' | 'breakthrough';
  source_subject_id?: number;
  source_topic_name?: string;
  source_topic_description?: string;
  breakthrough_title?: string;
  breakthrough_summary?: string;
  breakthrough_source?: string;
  breakthrough_relevance?: string;
  field: string;
  confidence_score: number;
  created_at: number;
  expires_at?: number;
}

export interface EnrichmentDismissal {
  id: number;
  user_id: number;
  suggestion_id: number;
  dismissed_at: number;
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
  solution_objectives?: string; // JSON array of marking criteria
  markscheme_id?: number;
  paper_date?: string; // e.g., "2022-06"
  question_number?: string; // e.g., "1-3-5"
  diagram_mermaid?: string; // Natural language diagram description for AI image generation
  categorization_confidence?: number; // 0-100
  categorization_reasoning?: string; // Brief explanation of categorization
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
