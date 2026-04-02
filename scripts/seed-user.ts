/**
 * Seed script: creates the database and inserts a default user account.
 * Usage: npx ts-node scripts/seed-user.ts
 */
import BetterSqlite3 from 'better-sqlite3';
import { hashSync } from 'bcryptjs';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'db');
const DB_PATH = path.join(DB_DIR, 'exammer.db');
const SCHEMA_PATH = path.join(process.cwd(), 'src', 'lib', 'db', 'schema.sql');

// Ensure db directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Ensure users.json exists (migration system expects it)
const USERS_FILE = path.join(DB_DIR, 'users.json');
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), 'utf-8');
}

const isNew = !fs.existsSync(DB_PATH);
const db = new BetterSqlite3(DB_PATH);

// Apply schema if fresh database
if (isNew) {
  console.log('Creating new database and applying schema...');
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);

  // Set db_version so migration system knows we're current
  const versionFile = JSON.parse(fs.readFileSync(path.join(DB_DIR, 'db_vers.json'), 'utf-8'));
  db.prepare('INSERT INTO db_version (version) VALUES (?)').run(versionFile.currentVersion);
  console.log('Schema applied, version set to', versionFile.currentVersion);
} else {
  console.log('Database already exists.');
}

// Seed user
const email = 'admin@exammer.co.uk';
const password = 'admin123';
const name = 'Vanja';

const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
if (existing) {
  console.log(`User ${email} already exists, skipping.`);
} else {
  const hash = hashSync(password, 10);
  db.prepare(
    'INSERT INTO users (email, password_hash, name, email_verified, access_level) VALUES (?, ?, ?, 1, 1)'
  ).run(email, hash, name);
  console.log(`Created user: ${email} / ${password}`);
}

db.close();
console.log('Done!');
