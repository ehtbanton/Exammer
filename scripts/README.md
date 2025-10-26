# Database Migration Scripts

This directory contains scripts for managing database migrations in Exammer.

## Available Scripts

### migrate-database.ts

**Purpose:** Manually migrate the database to the latest schema version.

**Usage:**
```bash
npm run migrate:db
```

**What it does:**
- Checks for missing schema updates
- Applies migrations in order
- Backs up data before changes
- Verifies migrations succeeded
- Provides detailed console output

**When to use:**
- When automatic migration fails
- Before deploying to production
- To verify migration on a database copy
- For troubleshooting schema issues

### test-migration.ts

**Purpose:** Verify that database migrations have been applied correctly.

**Usage:**
```bash
npm run test:migration
```

**What it does:**
- Checks all required columns exist
- Verifies correct data types
- Tests indexes are created
- Validates data integrity
- Runs SQLite integrity check

**When to use:**
- After running migrations
- Before deploying to production
- To diagnose migration issues
- As part of CI/CD pipeline

## Migration Workflow

### For Development

1. **Start application** - Automatic migration runs on startup
2. **Verify in console** - Check for migration success messages
3. **Test functionality** - Ensure features work as expected

### For Production

1. **Backup database**
   ```bash
   cp db/exammer.db db/exammer.db.backup
   ```

2. **Test migration on backup**
   ```bash
   # Make a test copy
   cp db/exammer.db db/exammer-test.db

   # Run migration script on test copy
   # (temporarily change DB_PATH in script)
   npm run migrate:db
   ```

3. **Verify test migration**
   ```bash
   npm run test:migration
   ```

4. **Deploy and let automatic migration run**
   ```bash
   npm run build
   npm start
   ```

5. **Verify production migration**
   ```bash
   npm run test:migration
   ```

## Troubleshooting

### Migration Script Fails

If `npm run migrate:db` fails:

1. **Check file permissions**
   ```bash
   # Windows
   icacls db\exammer.db

   # Linux/Mac
   ls -la db/exammer.db
   ```

2. **Check database integrity**
   ```bash
   sqlite3 db/exammer.db "PRAGMA integrity_check;"
   ```

3. **Restore from backup**
   ```bash
   # Windows
   copy db\exammer.db.backup db\exammer.db

   # Linux/Mac
   cp db/exammer.db.backup db/exammer.db
   ```

### Test Script Fails

If `npm run test:migration` reports failures:

1. **Run migration**
   ```bash
   npm run migrate:db
   ```

2. **Check error details** - The test output shows what's missing

3. **Verify database path** - Ensure database is at `db/exammer.db`

### Common Issues

**Issue:** "Database file not found"
- **Solution:** Ensure `db/exammer.db` exists, run the app once to create it

**Issue:** "Error opening database: database is locked"
- **Solution:** Stop the application before running manual migration

**Issue:** "Migration verification failed"
- **Solution:** Check console logs for specific error, may need to restore from backup

**Issue:** "Cannot run ts-node"
- **Solution:** Install dependencies: `npm install`

## Adding New Migrations

When adding a new migration:

1. **Update database schema** (`src/lib/db/schema.sql`)
2. **Add automatic migration** (`src/lib/db/index.ts` in `runAdditionalMigrations()`)
3. **Add manual migration** (this file, in `migrate()` method)
4. **Add tests** (`test-migration.ts`, add new test methods)
5. **Update documentation** (`MIGRATION.md`)
6. **Test thoroughly** on database copy before committing

### Migration Template

```typescript
// In migrate-database.ts
private async migrateToV3() {
  console.log('Migration V3: Adding [feature description]...');

  const columns = await this.all<ColumnInfo>('PRAGMA table_info([table_name])');
  const has[ColumnName] = columns.some(col => col.name === '[column_name]');

  if (has[ColumnName]) {
    console.log('✓ [column_name] column already exists - skipping');
    return;
  }

  console.log('\nAdding [column_name] column...');
  await this.run('ALTER TABLE [table_name] ADD COLUMN [column_name] [TYPE] DEFAULT [value]');
  console.log('✓ Added [column_name] column');

  // Verify
  const updatedColumns = await this.all<ColumnInfo>('PRAGMA table_info([table_name])');
  const verified = updatedColumns.some(col => col.name === '[column_name]');

  if (!verified) {
    throw new Error('Migration verification failed');
  }

  console.log('✓ Migration verified');
  console.log('\nMigration V3 completed successfully!\n');
}
```

## Files

- `migrate-database.ts` - Manual migration script
- `test-migration.ts` - Migration verification tests
- `README.md` - This file

## Related Documentation

- [Main Migration Guide](../MIGRATION.md) - Complete migration documentation
- [Database Schema](../src/lib/db/schema.sql) - Current schema definition
- [Database Implementation](../src/lib/db/index.ts) - Automatic migration code
