/**
 * Check Diagram Data in Questions
 *
 * This script analyzes questions to see which have diagrams and in what format.
 *
 * Usage:
 *   npx ts-node scripts/check-diagram-data.ts
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'db', 'exammer.db');

interface Question {
  id: number;
  question_text: string;
  summary: string;
  diagram_geogebra: string | null;
  diagram_bounds: string | null;
}

class DiagramDataChecker {
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

  async checkDiagrams(): Promise<void> {
    console.log('\n=== Diagram Data Analysis ===\n');

    try {
      const questions = await this.all<Question>(
        'SELECT id, question_text, summary, diagram_geogebra, diagram_bounds FROM questions LIMIT 100'
      );

      let withAsymptoteCode = 0;
      let withGeoGebraData = 0;
      let withBothIssues = 0;
      let clean = 0;

      console.log(`Analyzing ${questions.length} questions...\n`);

      questions.forEach((q) => {
        const hasAsymptote = /\[asy\]/i.test(q.question_text);
        const hasGeoGebra = q.diagram_geogebra !== null && q.diagram_geogebra.trim() !== '';

        if (hasAsymptote && hasGeoGebra) {
          withBothIssues++;
          console.log(`⚠️  Question ${q.id}: Has BOTH Asymptote code AND GeoGebra data`);
          console.log(`   Summary: ${q.summary.substring(0, 60)}...`);
        } else if (hasAsymptote) {
          withAsymptoteCode++;
          console.log(`❌ Question ${q.id}: Has Asymptote code in question_text (needs cleanup)`);
          console.log(`   Summary: ${q.summary.substring(0, 60)}...`);
        } else if (hasGeoGebra) {
          withGeoGebraData++;
          console.log(`✅ Question ${q.id}: Has GeoGebra data`);
          try {
            const commands = JSON.parse(q.diagram_geogebra!);
            console.log(`   Commands: ${commands.length} GeoGebra commands`);
            console.log(`   Bounds: ${q.diagram_bounds ? 'Yes' : 'No'}`);
          } catch (e) {
            console.log(`   ERROR: Invalid JSON in diagram_geogebra`);
          }
        } else {
          clean++;
        }
      });

      console.log('\n=== Summary ===');
      console.log(`Total questions analyzed: ${questions.length}`);
      console.log(`✅ With GeoGebra data: ${withGeoGebraData}`);
      console.log(`❌ With Asymptote code (needs cleanup): ${withAsymptoteCode}`);
      console.log(`⚠️  With BOTH (inconsistent): ${withBothIssues}`);
      console.log(`📝 Clean (no diagram): ${clean}`);

      if (withAsymptoteCode > 0) {
        console.log('\n💡 Recommendation:');
        console.log('Run: npx ts-node scripts/clean-asymptote-code.ts');
        console.log('This will remove Asymptote code from question_text.');
        console.log('Then re-extract the papers to get GeoGebra diagrams.');
      }
    } catch (err) {
      console.error('Error:', err);
      throw err;
    }
  }

  async run(): Promise<void> {
    try {
      await this.checkDiagrams();
    } finally {
      await this.close();
    }
  }
}

const checker = new DiagramDataChecker(DB_PATH);
checker.run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Script failed:', err);
    process.exit(1);
  });
