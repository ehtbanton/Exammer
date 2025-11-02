/**
 * Database Migration System
 *
 * This module handles automatic database migrations on application startup.
 * It reads the version specification from db_vers.json and applies necessary
 * migrations to bring the database to the current version.
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'db');
const DB_PATH = path.join(DB_DIR, 'exammer.db');
const VERSION_FILE = path.join(DB_DIR, 'db_vers.json');
const USERS_FILE = path.join(DB_DIR, 'users.json');

interface VersionSpec {
  currentVersion: number;
  versions: {
    [key: string]: {
      description: string;
      schema: any;
      migration?: {
        from: number;
        steps: Array<{
          action: string;
          table?: string;
          sql?: string;
          description?: string;
          steps?: string[];
        }>;
      };
    };
  };
}

export class DatabaseMigrator {
  private db!: sqlite3.Database;
  private versionSpec: VersionSpec;
  private initPromise: Promise<void>;

  constructor(dbPath: string = DB_PATH) {
    // Ensure db directory exists
    if (!fs.existsSync(DB_DIR)) {
      console.log(`Creating database directory: ${DB_DIR}`);
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    // Ensure users.json exists
    if (!fs.existsSync(USERS_FILE)) {
      console.log(`Creating users.json file: ${USERS_FILE}`);
      fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), 'utf-8');
    }

    // Load version specification
    if (!fs.existsSync(VERSION_FILE)) {
      throw new Error(`Version file not found: ${VERSION_FILE}`);
    }

    this.versionSpec = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));

    // Check if database exists
    const dbExists = fs.existsSync(dbPath);
    const isNewDatabase = !dbExists;

    if (!dbExists) {
      console.log(`Database does not exist, will create new database at: ${dbPath}`);
    }

    // Open database connection asynchronously (creates file if it doesn't exist)
    this.initPromise = new Promise(async (resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, async (err) => {
        if (err) {
          console.error('Error opening database for migration:', err);
          reject(err);
          return;
        }

        // If database was just created, initialize it with base schema
        if (isNewDatabase) {
          try {
            await this.initializeNewDatabase();
            console.log('✅ New database initialization complete');
          } catch (initError) {
            console.error('Error initializing new database:', initError);
            reject(initError);
            return;
          }
        }
        resolve();
      });
    });
  }

  private async ready(): Promise<void> {
    await this.initPromise;
  }

  /**
   * Initialize a new database with base schema
   * The schema.sql file contains the latest schema, so we set the version to currentVersion
   * and skip running migrations
   */
  private async initializeNewDatabase(): Promise<void> {
    console.log('\n🆕 Initializing new database with current schema...\n');

    try {
      // Read and apply the base schema (which is already at the latest version)
      const schemaPath = path.join(process.cwd(), 'src', 'lib', 'db', 'schema.sql');

      if (!fs.existsSync(schemaPath)) {
        throw new Error(`Schema file not found: ${schemaPath}`);
      }

      const schema = fs.readFileSync(schemaPath, 'utf8');

      // Execute schema
      await new Promise<void>((resolve, reject) => {
        this.db.exec(schema, (err) => {
          if (err) {
            console.error('Error applying base schema:', err);
            reject(err);
          } else {
            console.log('✅ Base schema applied successfully');
            resolve();
          }
        });
      });

      // The schema.sql already includes db_version table creation, but we need to set the version
      // Set the version to currentVersion since we applied the latest schema
      await new Promise<void>((resolve, reject) => {
        this.db.run(
          'INSERT INTO db_version (version) VALUES (?)',
          [this.versionSpec.currentVersion],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      console.log(`✅ Fresh database initialized at version ${this.versionSpec.currentVersion}`);
      console.log('   No migrations needed - schema is already current\n');
    } catch (error) {
      console.error('Failed to initialize new database:', error);
      throw error;
    }
  }

  private async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    await this.ready();
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  private async run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    await this.ready();
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  private async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    await this.ready();
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T | undefined);
      });
    });
  }

  /**
   * Get the current database version
   */
  private async getCurrentVersion(): Promise<number> {
    try {
      // Check if db_version table exists
      const tables = await this.all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='db_version'"
      );

      if (tables.length === 0) {
        // No version table, this is version 0 (initial schema)
        return 0;
      }

      const result = await this.get<{ version: number }>(
        'SELECT version FROM db_version ORDER BY id DESC LIMIT 1'
      );

      return result?.version ?? 0;
    } catch (error) {
      console.error('Error getting current version:', error);
      return 0;
    }
  }

  /**
   * Set the database version
   */
  private async setVersion(version: number): Promise<void> {
    // Ensure db_version table exists
    await this.run(`
      CREATE TABLE IF NOT EXISTS db_version (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER NOT NULL,
        migrated_at INTEGER DEFAULT (unixepoch())
      )
    `);

    await this.run('INSERT INTO db_version (version) VALUES (?)', [version]);
  }

  /**
   * Apply a migration step
   */
  private async applyMigrationStep(step: any, stepIndex: number): Promise<void> {
    console.log(`  [Step ${stepIndex + 1}] ${step.action}: ${step.description || step.table || ''}`);

    try {
      switch (step.action) {
        case 'create_table':
        case 'create_index':
        case 'migrate_data':
        case 'recreate_indexes':
        case 'add_column':
          if (step.sql) {
            await this.run(step.sql);
            console.log(`    ✓ Executed SQL`);
          }
          break;

        case 'drop_column_simulation':
          if (step.steps && Array.isArray(step.steps)) {
            for (let i = 0; i < step.steps.length; i++) {
              const sql = step.steps[i];
              console.log(`    [${i + 1}/${step.steps.length}] ${sql.substring(0, 60)}...`);
              await this.run(sql);
            }
            console.log(`    ✓ Completed ${step.steps.length} sub-steps`);
          }
          break;

        default:
          console.warn(`    ⚠ Unknown action: ${step.action}`);
      }
    } catch (error) {
      console.error(`    ✗ Failed to execute step:`, error);
      throw error;
    }
  }

  /**
   * Migrate from one version to another
   */
  private async migrateToVersion(targetVersion: number): Promise<void> {
    const versionInfo = this.versionSpec.versions[targetVersion.toString()];

    if (!versionInfo) {
      throw new Error(`Version ${targetVersion} not found in specification`);
    }

    if (!versionInfo.migration) {
      console.log(`No migration needed for version ${targetVersion}`);
      return;
    }

    console.log(`\n🔄 Migrating to version ${targetVersion}: ${versionInfo.description}`);
    console.log(`   From version: ${versionInfo.migration.from}`);

    // Begin transaction
    await this.run('BEGIN TRANSACTION');

    try {
      // Apply each migration step
      for (let i = 0; i < versionInfo.migration.steps.length; i++) {
        const step = versionInfo.migration.steps[i];
        await this.applyMigrationStep(step, i);
      }

      // Update version
      await this.setVersion(targetVersion);

      // Commit transaction
      await this.run('COMMIT');

      console.log(`✅ Successfully migrated to version ${targetVersion}\n`);
    } catch (error) {
      // Rollback on error
      await this.run('ROLLBACK');
      throw error;
    }
  }

  /**
   * Verify that the schema actually matches the expected version
   * Returns true if schema is correct, false if it needs repair
   */
  private async verifySchemaForVersion(version: number): Promise<boolean> {
    if (version === 3) {
      // Check if version 3 columns actually exist
      try {
        const columns = await this.all<{ name: string }>(
          "PRAGMA table_info(questions)"
        );
        const columnNames = columns.map(c => c.name);

        const hasSolutionObjectives = columnNames.includes('solution_objectives');
        const hasMarkschemeId = columnNames.includes('markscheme_id');

        if (!hasSolutionObjectives || !hasMarkschemeId) {
          console.log('⚠ Version 3 schema verification failed: missing columns in questions table');
          return false;
        }

        const userProgressColumns = await this.all<{ name: string }>(
          "PRAGMA table_info(user_progress)"
        );
        const upColumnNames = userProgressColumns.map(c => c.name);

        const hasCompletedObjectives = upColumnNames.includes('completed_objectives');

        if (!hasCompletedObjectives) {
          console.log('⚠ Version 3 schema verification failed: missing columns in user_progress table');
          return false;
        }

        // Check if markschemes table exists
        const tables = await this.all<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='markschemes'"
        );

        if (tables.length === 0) {
          console.log('⚠ Version 3 schema verification failed: markschemes table missing');
          return false;
        }

        return true;
      } catch (error) {
        console.error('Error verifying schema:', error);
        return false;
      }
    }

    return true; // For other versions, assume they're correct
  }

  /**
   * Re-apply migration steps for the current version (used when schema verification fails)
   */
  private async repairVersion(version: number): Promise<void> {
    const versionInfo = this.versionSpec.versions[version.toString()];

    if (!versionInfo || !versionInfo.migration) {
      console.log(`No migration steps to repair version ${version}`);
      return;
    }

    console.log(`\n🔧 Repairing version ${version}: ${versionInfo.description}`);

    // Begin transaction
    await this.run('BEGIN TRANSACTION');

    try {
      // Apply each migration step
      for (let i = 0; i < versionInfo.migration.steps.length; i++) {
        const step = versionInfo.migration.steps[i];
        try {
          await this.applyMigrationStep(step, i);
        } catch (error: any) {
          // If column already exists, that's ok - continue
          if (error.message && error.message.includes('duplicate column')) {
            console.log(`    ℹ Column already exists, skipping`);
          } else {
            throw error;
          }
        }
      }

      // Commit transaction
      await this.run('COMMIT');

      console.log(`✅ Successfully repaired version ${version}\n`);
    } catch (error) {
      // Rollback on error
      await this.run('ROLLBACK');
      throw error;
    }
  }

  /**
   * Check and perform migrations if needed
   */
  async checkAndMigrate(): Promise<void> {
    console.log('\n═══════════════════════════════════════════');
    console.log('  DATABASE MIGRATION CHECK');
    console.log('═══════════════════════════════════════════\n');

    const currentVersion = await this.getCurrentVersion();
    const targetVersion = this.versionSpec.currentVersion;

    console.log(`Current database version: ${currentVersion}`);
    console.log(`Target version: ${targetVersion}`);

    if (currentVersion === targetVersion) {
      // Verify the schema actually matches
      const schemaIsValid = await this.verifySchemaForVersion(currentVersion);

      if (!schemaIsValid) {
        console.log('⚠ Database version is correct but schema is incomplete');
        console.log('🔧 Repairing schema...\n');
        await this.repairVersion(currentVersion);
        console.log('✓ Schema repair complete!\n');
      } else {
        console.log('✓ Database is up to date!\n');
      }
      return;
    }

    if (currentVersion > targetVersion) {
      console.error('⚠ WARNING: Database version is newer than expected!');
      console.error(`  Database: v${currentVersion}, Expected: v${targetVersion}`);
      console.error('  This may indicate a downgrade, which is not supported.\n');
      return;
    }

    // Perform migrations
    console.log(`\n📦 Migrations required: v${currentVersion} → v${targetVersion}\n`);

    for (let version = currentVersion + 1; version <= targetVersion; version++) {
      await this.migrateToVersion(version);
    }

    console.log('═══════════════════════════════════════════');
    console.log('  MIGRATION COMPLETE');
    console.log('═══════════════════════════════════════════\n');
  }

  /**
   * Verify database integrity
   */
  async verify(): Promise<boolean> {
    try {
      const result = await this.all('PRAGMA integrity_check');
      const isOk = result.length === 1 && (result[0] as any).integrity_check === 'ok';

      if (isOk) {
        console.log('✓ Database integrity check passed');
      } else {
        console.error('✗ Database integrity check failed:', result);
      }

      return isOk;
    } catch (error) {
      console.error('✗ Error during integrity check:', error);
      return false;
    }
  }

  async close(): Promise<void> {
    await this.ready();
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

/**
 * Run migrations (for use in application startup)
 */
export async function runMigrations(): Promise<void> {
  const migrator = new DatabaseMigrator();

  try {
    await migrator.checkAndMigrate();
    await migrator.verify();
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await migrator.close();
  }
}

// Allow running this file directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
