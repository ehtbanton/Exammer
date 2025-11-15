/**
 * Clean Asymptote Code from Questions
 *
 * This script finds and removes Asymptote diagram code from question_text fields.
 * Asymptote code appears as [asy]...[/asy] blocks and should not be in the question text.
 *
 * The script will:
 * 1. Find all questions with [asy] markers in question_text
 * 2. Remove the Asymptote code blocks from question_text
 * 3. Log all affected questions for review
 *
 * Note: This does NOT convert Asymptote to GeoGebra. Questions with geometric
 * diagrams should be re-extracted from their source PDFs using the updated
 * extraction prompt which properly converts diagrams to GeoGebra format.
 *
 * Usage:
 *   npx ts-node scripts/clean-asymptote-code.ts
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'db', 'exammer.db');

interface Question {
  id: number;
  question_text: string;
  summary: string;
  topic_id: number;
}

class AsymptoteCodeCleaner {
  private db: sqlite3.Database;

  constructor(dbPath: string) {
    if (!fs.existsSync(dbPath)) {
      console.error(`Database file not found at: ${dbPath}`);
      console.error('Please ensure the database exists.');
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

  private run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
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

  /**
   * Removes Asymptote code blocks from text
   * Asymptote code is marked with [asy]...[/asy]
   */
  private removeAsymptoteCode(text: string): { cleaned: string; hasAsymptote: boolean } {
    const asymptotePattern = /\[asy\][\s\S]*?\[\/asy\]/gi;
    const hasAsymptote = asymptotePattern.test(text);

    if (!hasAsymptote) {
      return { cleaned: text, hasAsymptote: false };
    }

    // Remove all [asy]...[/asy] blocks
    let cleaned = text.replace(asymptotePattern, '').trim();

    // Clean up multiple consecutive newlines
    cleaned = cleaned.replace(/\n\n+/g, '\n\n');

    // Trim any leading/trailing whitespace
    cleaned = cleaned.trim();

    return { cleaned, hasAsymptote: true };
  }

  async cleanQuestions(): Promise<void> {
    console.log('\n=== Starting Asymptote Code Cleanup ===\n');

    try {
      // Find all questions
      console.log('Fetching all questions from database...');
      const questions = await this.all<Question>(
        'SELECT id, question_text, summary, topic_id FROM questions'
      );
      console.log(`Found ${questions.length} questions total.\n`);

      let questionsWithAsymptote = 0;
      let questionsUpdated = 0;
      const affectedQuestions: Array<{ id: number; summary: string; topic_id: number }> = [];

      // Process each question
      for (const question of questions) {
        const { cleaned, hasAsymptote } = this.removeAsymptoteCode(question.question_text);

        if (hasAsymptote) {
          questionsWithAsymptote++;

          console.log(`\n--- Question ID: ${question.id} ---`);
          console.log(`Topic ID: ${question.topic_id}`);
          console.log(`Summary: ${question.summary}`);
          console.log(`\nOriginal length: ${question.question_text.length} characters`);
          console.log(`Cleaned length: ${cleaned.length} characters`);
          console.log(`Removed: ${question.question_text.length - cleaned.length} characters`);

          // Show preview of cleaned text (first 200 chars)
          const preview = cleaned.substring(0, 200);
          console.log(`\nCleaned text preview:\n${preview}${cleaned.length > 200 ? '...' : ''}`);

          // Update the question in the database
          try {
            await this.run(
              'UPDATE questions SET question_text = ? WHERE id = ?',
              [cleaned, question.id]
            );
            questionsUpdated++;
            affectedQuestions.push({
              id: question.id,
              summary: question.summary,
              topic_id: question.topic_id,
            });
            console.log('✓ Updated successfully');
          } catch (err) {
            console.error(`✗ Failed to update question ${question.id}:`, err);
          }
        }
      }

      console.log('\n=== Cleanup Complete ===\n');
      console.log(`Total questions: ${questions.length}`);
      console.log(`Questions with Asymptote code: ${questionsWithAsymptote}`);
      console.log(`Questions updated: ${questionsUpdated}`);

      if (affectedQuestions.length > 0) {
        console.log('\n=== Affected Questions ===');
        console.log('The following questions had Asymptote code removed:\n');
        affectedQuestions.forEach((q, idx) => {
          console.log(`${idx + 1}. ID: ${q.id}, Topic: ${q.topic_id}`);
          console.log(`   Summary: ${q.summary}`);
        });

        console.log('\n⚠️  IMPORTANT NOTES:');
        console.log('1. Asymptote code has been removed from question text');
        console.log('2. Questions with geometric diagrams should ideally be re-extracted');
        console.log('   from their source PDFs using the updated extraction prompt');
        console.log('3. The updated prompt will convert diagrams to GeoGebra format');
        console.log('4. Consider re-extracting papers that contained these questions\n');
      } else {
        console.log('\n✓ No questions with Asymptote code found.');
      }
    } catch (err) {
      console.error('\n✗ Error during cleanup:', err);
      throw err;
    }
  }

  async run(): Promise<void> {
    try {
      await this.cleanQuestions();
    } finally {
      await this.close();
      console.log('\nDatabase connection closed.');
    }
  }
}

// Run the cleaner
const cleaner = new AsymptoteCodeCleaner(DB_PATH);
cleaner.run()
  .then(() => {
    console.log('\n✓ Script completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n✗ Script failed:', err);
    process.exit(1);
  });
