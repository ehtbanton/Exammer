-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name TEXT,
  email_verified INTEGER DEFAULT 0,
  access_level INTEGER DEFAULT 0,
  image TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- NextAuth accounts table (for OAuth providers)
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(provider, provider_account_id)
);

-- NextAuth sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  expires INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- NextAuth verification tokens (for email verification and password reset)
CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires INTEGER NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- Subjects table (V1: workspace architecture - subjects are public, users link via user_workspaces)
CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  syllabus_content TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- User workspaces table (V1: links users to subjects in their workspace)
CREATE TABLE IF NOT EXISTS user_workspaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  is_creator INTEGER DEFAULT 0,
  added_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  UNIQUE(user_id, subject_id)
);

-- Past papers table
CREATE TABLE IF NOT EXISTS past_papers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

-- Markschemes table
CREATE TABLE IF NOT EXISTS markschemes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

-- Paper types table
CREATE TABLE IF NOT EXISTS paper_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

-- Topics table
CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paper_type_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (paper_type_id) REFERENCES paper_types(id) ON DELETE CASCADE
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  summary TEXT NOT NULL,
  solution_objectives TEXT,
  markscheme_id INTEGER,
  paper_date TEXT,
  question_number TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
  FOREIGN KEY (markscheme_id) REFERENCES markschemes(id) ON DELETE SET NULL
);

-- User progress table (tracks scores and attempts for each question)
CREATE TABLE IF NOT EXISTS user_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  score INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  score_history TEXT DEFAULT '[]',
  completed_objectives TEXT DEFAULT '[]',
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  UNIQUE(user_id, question_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_subjects_name ON subjects(name);
CREATE INDEX IF NOT EXISTS idx_user_workspaces_user_id ON user_workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_user_workspaces_subject_id ON user_workspaces(subject_id);
CREATE INDEX IF NOT EXISTS idx_past_papers_subject_id ON past_papers(subject_id);
CREATE INDEX IF NOT EXISTS idx_markschemes_subject_id ON markschemes(subject_id);
CREATE INDEX IF NOT EXISTS idx_paper_types_subject_id ON paper_types(subject_id);
CREATE INDEX IF NOT EXISTS idx_topics_paper_type_id ON topics(paper_type_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic_id ON questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_question_id ON user_progress(question_id);

-- Donations table
CREATE TABLE IF NOT EXISTS donations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  amount REAL NOT NULL,
  currency_code TEXT DEFAULT 'USD',
  donor_name TEXT,
  donor_email TEXT,
  donor_message TEXT,
  paypal_invoice_id TEXT,
  paypal_invoice_url TEXT,
  invoice_status TEXT DEFAULT 'DRAFT',
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for donations table
CREATE INDEX IF NOT EXISTS idx_donations_user_id ON donations(user_id);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(invoice_status);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at);

-- Database version tracking table
CREATE TABLE IF NOT EXISTS db_version (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version INTEGER NOT NULL,
  migrated_at INTEGER DEFAULT (unixepoch())
);
