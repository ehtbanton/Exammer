# Database Migration Guide

This document explains how the database migration system works in Exammer and how to handle database schema updates.

## Overview

Exammer uses SQLite as its database and includes an automatic migration system that runs when the application starts. The migration system ensures that your database schema is up-to-date with the latest changes.

## Automatic Migration

### How It Works

When you start the application, the database initialization code automatically:

1. **Checks the current schema** - Uses SQLite's `PRAGMA table_info()` to inspect existing tables
2. **Identifies missing columns** - Compares current schema with expected schema
3. **Applies migrations** - Adds missing columns and indexes as needed
4. **Verifies changes** - Confirms that migrations were applied successfully

This process happens automatically in `src/lib/db/index.ts` during the Database class initialization.

### Migration Log Output

You'll see logs like this in your console when migrations run:

```
Connected to SQLite database at db/exammer.db
Database schema initialized successfully
Checking for database migrations...
[MIGRATION] is_public column already exists, skipping migration
Database migrations completed
```

If a migration is needed:

```
Checking for database migrations...
[MIGRATION] Adding is_public column to subjects table...
[MIGRATION] Added is_public column successfully
[MIGRATION] Created index on is_public column
[MIGRATION] Migration verified successfully
Database migrations completed
```

## Manual Migration

If you need to manually migrate your database (for troubleshooting or verification), you can run:

```bash
npm run migrate:db
```

This will:
- Connect to your database at `db/exammer.db`
- Check which migrations are needed
- Apply any missing migrations
- Verify data integrity
- Provide detailed console output

### Expected Output

```
Connected to database at: C:\Users\...\db\exammer.db

=== Starting Database Migration ===

Migration V2: Adding public subject support...
Current subjects table columns: id, user_id, name, syllabus_content, created_at, updated_at

Creating backup of subjects table...
✓ Backed up 5 subjects

Adding is_public column to subjects table...
✓ Added is_public column
Creating index on is_public column...
✓ Created index
✓ Migration verified
Updated subjects table columns: id, user_id, name, syllabus_content, is_public, created_at, updated_at
✓ Data integrity verified

Migration V2 completed successfully!

=== All Migrations Completed Successfully ===

Database connection closed
```

## Current Migrations

### Migration V2: Public Subject Support (2025-01-XX)

**What it does:**
- Adds `is_public` column to the `subjects` table
- Creates an index on `is_public` for query performance
- Sets default value to `0` (private) for all existing subjects

**Schema changes:**
```sql
ALTER TABLE subjects ADD COLUMN is_public INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_subjects_is_public ON subjects(is_public);
```

**Data impact:**
- All existing subjects remain private (`is_public = 0`)
- No data loss
- No changes to existing functionality

## Database Schema

### Current Schema (V2)

```sql
CREATE TABLE subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  syllabus_content TEXT,
  is_public INTEGER DEFAULT 0,  -- NEW in V2
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_subjects_user_id ON subjects(user_id);
CREATE INDEX idx_subjects_is_public ON subjects(is_public);  -- NEW in V2
```

## Troubleshooting

### Migration Fails

If automatic migration fails:

1. **Check console logs** - Look for `[MIGRATION ERROR]` messages
2. **Run manual migration** - Execute `npm run migrate:db`
3. **Check file permissions** - Ensure the database file is writable
4. **Verify database integrity** - Use `sqlite3 db/exammer.db "PRAGMA integrity_check;"`

### Database Backup

Before running migrations, it's recommended to backup your database:

```bash
# Windows
copy db\exammer.db db\exammer.db.backup

# Linux/Mac
cp db/exammer.db db/exammer.db.backup
```

### Restore from Backup

If something goes wrong:

```bash
# Windows
copy db\exammer.db.backup db\exammer.db

# Linux/Mac
cp db/exammer.db.backup db/exammer.db
```

## Adding New Migrations

When adding new migrations in the future:

1. **Update schema.sql** - Add the new column/table definition
2. **Add migration code** - Add a new migration check in `runAdditionalMigrations()`
3. **Add to standalone script** - Create a new migration method in `scripts/migrate-database.ts`
4. **Test thoroughly** - Test on a copy of a production database
5. **Document** - Update this file with the new migration details

### Example Migration Code

```typescript
private async runAdditionalMigrations() {
  console.log('Checking for database migrations...');

  try {
    // Migration 1: Add is_public column
    const tableInfo = await this.all<{ name: string }>('PRAGMA table_info(subjects)');
    const hasIsPublic = tableInfo.some(col => col.name === 'is_public');

    if (!hasIsPublic) {
      console.log('[MIGRATION] Adding is_public column...');
      await this.run('ALTER TABLE subjects ADD COLUMN is_public INTEGER DEFAULT 0');
      await this.run('CREATE INDEX IF NOT EXISTS idx_subjects_is_public ON subjects(is_public)');
      console.log('[MIGRATION] Migration completed');
    }

    // Migration 2: Add your new migration here
    // ...

    console.log('Database migrations completed');
  } catch (error) {
    console.error('[MIGRATION ERROR]:', error);
    throw error;
  }
}
```

## Migration Safety

The migration system is designed to be safe:

- ✅ **Idempotent** - Can be run multiple times without issues
- ✅ **Non-destructive** - Never deletes existing data
- ✅ **Verified** - Checks that migrations applied successfully
- ✅ **Logged** - Provides detailed console output
- ✅ **Automatic** - Runs on application startup
- ✅ **Manual fallback** - Can be run manually if needed

## Support

If you encounter issues with migrations:

1. Check the console logs for error messages
2. Review this documentation
3. Try running the manual migration script
4. Create a backup and restore if needed
5. Report issues with full error logs
