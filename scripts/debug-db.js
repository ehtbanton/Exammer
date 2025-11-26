const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(process.cwd(), 'db', 'exammer.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('--- Database Debug Info ---');

  // 1. Check DB Version
  db.get('SELECT version FROM db_version ORDER BY id DESC LIMIT 1', (err, row) => {
    if (err) console.log('Error getting version:', err.message);
    else console.log('Current DB Version:', row ? row.version : 'Unknown');
  });

  // 2. Check career_sessions columns
  db.all("PRAGMA table_info(career_sessions)", (err, rows) => {
    if (err) {
      console.log('Error checking schema:', err.message);
    } else {
      const columns = rows.map(r => r.name);
      console.log('\ncareer_sessions columns:', columns);
      
      const hasProfile = columns.includes('academic_profile');
      const hasComplete = columns.includes('academic_profile_complete');
      
      console.log('Has academic_profile:', hasProfile);
      console.log('Has academic_profile_complete:', hasComplete);
    }
  });

  // 3. Check user sessions
  db.all("SELECT * FROM career_sessions ORDER BY created_at DESC LIMIT 1", (err, rows) => {
    if (err) {
      console.log('Error fetching sessions:', err.message);
    } else {
      console.log('\nLatest Session Data:', rows);
    }
  });
});

db.close();
