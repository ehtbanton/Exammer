import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

// Database path - in /db folder
const DB_PATH = path.join(process.cwd(), 'db', 'erudate.db');

// Create a connection pool-like wrapper
class Database {
  private db: sqlite3.Database | null = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    this.db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
      } else {
        console.log('Connected to SQLite database at', DB_PATH);
        this.runMigrations();
      }
    });
  }

  private runMigrations() {
    const schemaPath = path.join(process.cwd(), 'src', 'lib', 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    this.db!.exec(schema, async (err) => {
      if (err) {
        console.error('Error running migrations:', err);
      } else {
        console.log('Database schema initialized successfully');
        // Initialize user access sync system
        try {
          const { initializeUserAccessSync } = await import('../user-access-sync');
          await initializeUserAccessSync();
        } catch (error) {
          console.error('Error initializing user access sync:', error);
        }
      }
    });
  }

  // Run a query that returns multiple rows
  all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  // Run a query that returns a single row
  get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db!.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T | undefined);
      });
    });
  }

  // Run a query that doesn't return rows (INSERT, UPDATE, DELETE)
  run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
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
  user_id: number;
  name: string;
  syllabus_content?: string;
  created_at: number;
  updated_at: number;
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
  updated_at: number;
}
