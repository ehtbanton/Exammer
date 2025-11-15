#!/usr/bin/env node

/**
 * Database Version Revert Tool
 *
 * Reverts the database to a previous version when a migration fails or needs to be re-run.
 *
 * Usage:
 *   node revert_db_version.js              # Revert to previous version (current - 1)
 *   node revert_db_version.js 5            # Revert to specific version
 *   node revert_db_version.js --list       # List version history
 */

const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'db', 'exammer.db');
const versionFilePath = path.join(__dirname, 'db', 'db_vers.json');

// Parse command line arguments
const args = process.argv.slice(2);
const targetVersionArg = args[0];

// Load version spec to get current expected version
let versionSpec;
try {
  versionSpec = JSON.parse(fs.readFileSync(versionFilePath, 'utf8'));
} catch (err) {
  console.error('❌ Error reading db_vers.json:', err.message);
  process.exit(1);
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }

  console.log('\n🔄 Database Version Revert Tool\n');

  // Get current database version
  db.get('SELECT version FROM db_version ORDER BY id DESC LIMIT 1', (err, row) => {
    if (err) {
      console.error('❌ Error getting current version:', err.message);
      db.close();
      process.exit(1);
    }

    const currentVersion = row?.version || 0;
    console.log(`Current database version: ${currentVersion}`);
    console.log(`Expected version (from db_vers.json): ${versionSpec.currentVersion}`);

    // Handle --list flag
    if (targetVersionArg === '--list' || targetVersionArg === '-l') {
      console.log('\n📜 Version History:');
      db.all('SELECT id, version, migrated_at FROM db_version ORDER BY id ASC', (err, rows) => {
        if (err) {
          console.error('❌ Error getting version history:', err.message);
          db.close();
          process.exit(1);
        }

        rows.forEach((row, index) => {
          const date = new Date(row.migrated_at * 1000).toLocaleString();
          const isCurrent = index === rows.length - 1 ? ' (CURRENT)' : '';
          console.log(`  ${row.id}. Version ${row.version} - ${date}${isCurrent}`);
        });

        console.log('\n💡 Usage:');
        console.log('  node revert_db_version.js        # Revert to previous version');
        console.log('  node revert_db_version.js 5      # Revert to specific version\n');

        db.close();
        process.exit(0);
      });
      return;
    }

    // Determine target version
    let targetVersion;
    if (targetVersionArg && !isNaN(parseInt(targetVersionArg))) {
      targetVersion = parseInt(targetVersionArg);
      console.log(`\n→ Target version specified: ${targetVersion}`);
    } else {
      targetVersion = currentVersion - 1;
      console.log(`\n→ Reverting to previous version: ${targetVersion}`);
    }

    // Validate target version
    if (targetVersion < 0) {
      console.error('❌ Cannot revert to version less than 0');
      db.close();
      process.exit(1);
    }

    if (targetVersion >= currentVersion) {
      console.error(`❌ Target version (${targetVersion}) must be less than current version (${currentVersion})`);
      console.log('💡 To upgrade, restart your application and let migrations run normally.');
      db.close();
      process.exit(1);
    }

    // Check if target version exists in spec
    if (!versionSpec.versions[targetVersion.toString()]) {
      console.warn(`⚠️  Warning: Version ${targetVersion} not found in db_vers.json`);
      console.log('   This may be a very old version or an invalid target.');
      // Continue anyway - user might know what they're doing
    } else {
      const versionInfo = versionSpec.versions[targetVersion.toString()];
      console.log(`   Description: ${versionInfo.description}`);
    }

    // Confirm the action
    console.log('\n⚠️  This will:');
    console.log(`   1. Remove version history entries from ${currentVersion} down to ${targetVersion + 1}`);
    console.log(`   2. Set database version to ${targetVersion}`);
    console.log('   3. On next startup, migrations will re-run from this point');
    console.log('\n   Note: This does NOT undo schema changes! It only resets the version.');
    console.log('         Use this when a migration failed or needs to be re-applied.');

    // Delete the latest version entry and insert the target version
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      // Delete all version entries after target version
      db.run('DELETE FROM db_version WHERE version > ?', [targetVersion], (err) => {
        if (err) {
          console.error('❌ Error deleting version entries:', err.message);
          db.run('ROLLBACK');
          db.close();
          process.exit(1);
        }

        // Insert new version entry
        db.run('INSERT INTO db_version (version) VALUES (?)', [targetVersion], (err) => {
          if (err) {
            console.error('❌ Error inserting version entry:', err.message);
            db.run('ROLLBACK');
            db.close();
            process.exit(1);
          }

          db.run('COMMIT', (err) => {
            if (err) {
              console.error('❌ Error committing transaction:', err.message);
              db.run('ROLLBACK');
              db.close();
              process.exit(1);
            }

            console.log(`\n✅ Successfully reverted database version to ${targetVersion}`);
            console.log('   Migrations will resume from this point on next startup.');
            console.log('\n💡 Next steps:');
            console.log('   1. Restart your application');
            console.log('   2. Migrations will automatically run');
            console.log('   3. Check the migration output for any errors\n');

            db.close((err) => {
              if (err) {
                console.error('❌ Error closing database:', err.message);
                process.exit(1);
              }
              process.exit(0);
            });
          });
        });
      });
    });
  });
});
