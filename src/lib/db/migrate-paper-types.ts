/**
 * Migration script to update database schema for paper_type_id architecture
 *
 * This migration:
 * 1. Adds paper_type_id column to past_papers table if it doesn't exist
 * 2. Adds paper_type_id column to markschemes table if it doesn't exist
 * 3. Attempts to assign paper_type_id based on existing question allocations
 * 4. Updates question_number format from old "P1-Q2-T3" to new "2" format
 * 5. Adds indexes for performance
 */

import { getDb } from './db';

interface PaperTypeInfo {
  id: number;
  subject_id: number;
  name: string;
}

interface PastPaperInfo {
  id: number;
  subject_id: number;
  name: string;
  paper_type_id?: number;
}

interface MarkschemeInfo {
  id: number;
  subject_id: number;
  name: string;
  paper_type_id?: number;
}

interface QuestionInfo {
  id: number;
  question_number: string | null;
  topic_id: number;
}

export async function migratePaperTypeArchitecture() {
  const db = await getDb();

  console.log('Starting paper type architecture migration...');

  try {
    // Start transaction
    await db.run('BEGIN TRANSACTION');

    // 1. Check if paper_type_id column exists in past_papers
    const pastPapersColumns = await db.all("PRAGMA table_info(past_papers)");
    const hasPaperTypeIdInPapers = pastPapersColumns.some((col: any) => col.name === 'paper_type_id');

    if (!hasPaperTypeIdInPapers) {
      console.log('Adding paper_type_id column to past_papers table...');
      await db.run('ALTER TABLE past_papers ADD COLUMN paper_type_id INTEGER');

      // Add foreign key constraint (SQLite doesn't support ALTER TABLE ADD CONSTRAINT)
      // We'll need to recreate the table
      console.log('Recreating past_papers table with foreign key...');

      // Get all existing data
      const existingPapers = await db.all('SELECT * FROM past_papers');

      // Create temporary table with new schema
      await db.run(`
        CREATE TABLE past_papers_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          subject_id INTEGER NOT NULL,
          paper_type_id INTEGER,
          name TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at INTEGER DEFAULT (unixepoch()),
          FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
          FOREIGN KEY (paper_type_id) REFERENCES paper_types(id) ON DELETE CASCADE
        )
      `);

      // Copy data
      for (const paper of existingPapers) {
        await db.run(
          'INSERT INTO past_papers_new (id, subject_id, paper_type_id, name, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [paper.id, paper.subject_id, null, paper.name, paper.content, paper.created_at]
        );
      }

      // Drop old table and rename new one
      await db.run('DROP TABLE past_papers');
      await db.run('ALTER TABLE past_papers_new RENAME TO past_papers');

      // Recreate indexes
      await db.run('CREATE INDEX IF NOT EXISTS idx_past_papers_subject_id ON past_papers(subject_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_past_papers_paper_type_id ON past_papers(paper_type_id)');
    }

    // 2. Check if paper_type_id column exists in markschemes
    const markschemesColumns = await db.all("PRAGMA table_info(markschemes)");
    const hasPaperTypeIdInMarkschemes = markschemesColumns.some((col: any) => col.name === 'paper_type_id');

    if (!hasPaperTypeIdInMarkschemes) {
      console.log('Adding paper_type_id column to markschemes table...');
      await db.run('ALTER TABLE markschemes ADD COLUMN paper_type_id INTEGER');

      console.log('Recreating markschemes table with foreign key...');

      // Get all existing data
      const existingMarkschemes = await db.all('SELECT * FROM markschemes');

      // Create temporary table with new schema
      await db.run(`
        CREATE TABLE markschemes_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          subject_id INTEGER NOT NULL,
          paper_type_id INTEGER,
          name TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at INTEGER DEFAULT (unixepoch()),
          FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
          FOREIGN KEY (paper_type_id) REFERENCES paper_types(id) ON DELETE CASCADE
        )
      `);

      // Copy data
      for (const markscheme of existingMarkschemes) {
        await db.run(
          'INSERT INTO markschemes_new (id, subject_id, paper_type_id, name, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [markscheme.id, markscheme.subject_id, null, markscheme.name, markscheme.content, markscheme.created_at]
        );
      }

      // Drop old table and rename new one
      await db.run('DROP TABLE markschemes');
      await db.run('ALTER TABLE markschemes_new RENAME TO markschemes');

      // Recreate indexes
      await db.run('CREATE INDEX IF NOT EXISTS idx_markschemes_subject_id ON markschemes(subject_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_markschemes_paper_type_id ON markschemes(paper_type_id)');
    }

    // 3. Try to assign paper_type_id to papers based on question allocations
    console.log('Attempting to assign paper_type_id to existing papers...');
    const papersWithoutPaperType = await db.all<PastPaperInfo[]>(
      'SELECT id, subject_id, name FROM past_papers WHERE paper_type_id IS NULL'
    );

    for (const paper of papersWithoutPaperType) {
      // Try to infer paper type from paper name (if it contains paper type name)
      const paperTypes = await db.all<PaperTypeInfo[]>(
        'SELECT id, name FROM paper_types WHERE subject_id = ?',
        [paper.subject_id]
      );

      let assignedPaperTypeId: number | null = null;

      // Check if paper name contains any paper type name
      for (const paperType of paperTypes) {
        if (paper.name.toLowerCase().includes(paperType.name.toLowerCase())) {
          assignedPaperTypeId = paperType.id;
          break;
        }
      }

      // If still not assigned and there's only one paper type, assign to that
      if (!assignedPaperTypeId && paperTypes.length === 1) {
        assignedPaperTypeId = paperTypes[0].id;
      }

      if (assignedPaperTypeId) {
        await db.run(
          'UPDATE past_papers SET paper_type_id = ? WHERE id = ?',
          [assignedPaperTypeId, paper.id]
        );
        console.log(`Assigned paper ${paper.id} (${paper.name}) to paper type ${assignedPaperTypeId}`);
      } else {
        console.warn(`Could not automatically assign paper_type_id for paper ${paper.id} (${paper.name})`);
      }
    }

    // 4. Try to assign paper_type_id to markschemes based on name matching
    console.log('Attempting to assign paper_type_id to existing markschemes...');
    const markschemesWithoutPaperType = await db.all<MarkschemeInfo[]>(
      'SELECT id, subject_id, name FROM markschemes WHERE paper_type_id IS NULL'
    );

    for (const markscheme of markschemesWithoutPaperType) {
      const paperTypes = await db.all<PaperTypeInfo[]>(
        'SELECT id, name FROM paper_types WHERE subject_id = ?',
        [markscheme.subject_id]
      );

      let assignedPaperTypeId: number | null = null;

      // Check if markscheme name contains any paper type name
      for (const paperType of paperTypes) {
        if (markscheme.name.toLowerCase().includes(paperType.name.toLowerCase())) {
          assignedPaperTypeId = paperType.id;
          break;
        }
      }

      // If still not assigned and there's only one paper type, assign to that
      if (!assignedPaperTypeId && paperTypes.length === 1) {
        assignedPaperTypeId = paperTypes[0].id;
      }

      if (assignedPaperTypeId) {
        await db.run(
          'UPDATE markschemes SET paper_type_id = ? WHERE id = ?',
          [assignedPaperTypeId, markscheme.id]
        );
        console.log(`Assigned markscheme ${markscheme.id} (${markscheme.name}) to paper type ${assignedPaperTypeId}`);
      } else {
        console.warn(`Could not automatically assign paper_type_id for markscheme ${markscheme.id} (${markscheme.name})`);
      }
    }

    // 5. Update question_number format from old "P1-Q2-T3" to new "2"
    console.log('Updating question_number format...');
    const questions = await db.all<QuestionInfo[]>(
      'SELECT id, question_number FROM questions WHERE question_number IS NOT NULL'
    );

    for (const question of questions) {
      if (question.question_number && question.question_number.includes('-')) {
        // Old format: "P1-Q2-T3" or "P1-Q2" -> extract the question number
        const match = question.question_number.match(/Q(\d+)/);
        if (match) {
          const newQuestionNumber = match[1];
          await db.run(
            'UPDATE questions SET question_number = ? WHERE id = ?',
            [newQuestionNumber, question.id]
          );
          console.log(`Updated question ${question.id} number from ${question.question_number} to ${newQuestionNumber}`);
        }
      }
    }

    // 6. Update subjects table to add description column if it doesn't exist
    const subjectsColumns = await db.all("PRAGMA table_info(subjects)");
    const hasDescription = subjectsColumns.some((col: any) => col.name === 'description');

    if (!hasDescription) {
      console.log('Adding description column to subjects table...');
      await db.run('ALTER TABLE subjects ADD COLUMN description TEXT');
    }

    // Commit transaction
    await db.run('COMMIT');

    console.log('Migration completed successfully!');

    // Report any papers or markschemes that still don't have paper_type_id
    const orphanedPapers = await db.all(
      'SELECT id, name FROM past_papers WHERE paper_type_id IS NULL'
    );

    const orphanedMarkschemes = await db.all(
      'SELECT id, name FROM markschemes WHERE paper_type_id IS NULL'
    );

    if (orphanedPapers.length > 0) {
      console.warn(`Warning: ${orphanedPapers.length} papers still need manual paper_type_id assignment:`);
      orphanedPapers.forEach((p: any) => console.warn(`  - Paper ${p.id}: ${p.name}`));
    }

    if (orphanedMarkschemes.length > 0) {
      console.warn(`Warning: ${orphanedMarkschemes.length} markschemes still need manual paper_type_id assignment:`);
      orphanedMarkschemes.forEach((m: any) => console.warn(`  - Markscheme ${m.id}: ${m.name}`));
    }

  } catch (error) {
    // Rollback on error
    await db.run('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migratePaperTypeArchitecture()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}
