#!/usr/bin/env node

/**
 * Check if diagram data exists for questions
 */

const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'exammer.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }

  console.log('\n📊 Checking diagram data in questions...\n');

  // Get all questions with their diagram data
  db.all(`
    SELECT
      id,
      question_text,
      diagram_geogebra,
      diagram_bounds
    FROM questions
    ORDER BY created_at DESC
    LIMIT 10
  `, (err, rows) => {
    if (err) {
      console.error('❌ Error querying questions:', err.message);
      db.close();
      process.exit(1);
    }

    console.log(`Found ${rows.length} recent questions:\n`);

    rows.forEach((row, index) => {
      const questionPreview = row.question_text.substring(0, 80).replace(/\n/g, ' ');
      console.log(`${index + 1}. Question ID: ${row.id}`);
      console.log(`   Preview: "${questionPreview}..."`);
      console.log(`   Has GeoGebra commands: ${row.diagram_geogebra ? 'YES ✓' : 'NO ✗'}`);

      if (row.diagram_geogebra) {
        try {
          const commands = JSON.parse(row.diagram_geogebra);
          console.log(`   Commands (${commands.length}): ${JSON.stringify(commands).substring(0, 100)}...`);
        } catch (e) {
          console.log(`   Commands (raw): ${row.diagram_geogebra.substring(0, 100)}...`);
        }
      }

      console.log(`   Has bounds: ${row.diagram_bounds ? 'YES ✓' : 'NO ✗'}`);
      if (row.diagram_bounds) {
        console.log(`   Bounds: ${row.diagram_bounds}`);
      }
      console.log('');
    });

    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err.message);
        process.exit(1);
      }
      console.log('✓ Done!\n');
      process.exit(0);
    });
  });
});
