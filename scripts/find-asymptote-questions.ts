/**
 * Find Questions with Asymptote Code
 *
 * Usage:
 *   npx ts-node scripts/find-asymptote-questions.ts
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'db', 'exammer.db');

interface Question {
  id: number;
  question_text: string;
  summary: string;
}

class AsymptoteFinder {
  private db: sqlite3.Database;

  constructor(dbPath: string) {
    if (!fs.existsSync(dbPath)) {
      console.error(`Database file not found at: ${dbPath}`);
      process.exit(1);
    }

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

  private close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async findAsymptote(): Promise<void> {
    console.log('\n=== Searching for Asymptote Code ===\n');

    try {
      // Search for [asy] in question_text
      const questions = await this.all<Question>(
        `SELECT id, question_text, summary FROM questions WHERE question_text LIKE '%[asy]%'`
      );

      if (questions.length === 0) {
        console.log('✅ No questions found with [asy] markers.');
        console.log('\nLet me check for questions with "diagram" in the text...\n');

        const diagramQuestions = await this.all<Question>(
          `SELECT id, question_text, summary FROM questions WHERE question_text LIKE '%diagram%' LIMIT 10`
        );

        if (diagramQuestions.length > 0) {
          console.log(`Found ${diagramQuestions.length} questions mentioning "diagram":\n`);
          diagramQuestions.forEach((q) => {
            console.log(`Question ID: ${q.id}`);
            console.log(`Summary: ${q.summary}`);
            console.log(`Text preview: ${q.question_text.substring(0, 200)}...`);
            console.log('---\n');
          });
        } else {
          console.log('No questions found with "diagram" in the text.');
        }
      } else {
        console.log(`Found ${questions.length} questions with Asymptote code:\n`);
        questions.forEach((q) => {
          console.log(`Question ID: ${q.id}`);
          console.log(`Summary: ${q.summary}`);

          // Find the [asy] block
          const asyMatch = q.question_text.match(/\[asy\][\s\S]*?\[\/asy\]/);
          if (asyMatch) {
            console.log(`Asymptote block length: ${asyMatch[0].length} characters`);
            console.log(`Preview: ${asyMatch[0].substring(0, 100)}...`);
          }
          console.log('---\n');
        });
      }
    } catch (err) {
      console.error('Error:', err);
      throw err;
    }
  }

  async run(): Promise<void> {
    try {
      await this.findAsymptote();
    } finally {
      await this.close();
    }
  }
}

const finder = new AsymptoteFinder(DB_PATH);
finder.run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Script failed:', err);
    process.exit(1);
  });
