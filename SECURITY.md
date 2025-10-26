# Security & Architecture Documentation

## Overview

Exammer implements a comprehensive multi-user authentication and authorization system with strict data isolation between users. This document explains the security model, data architecture, and access control mechanisms.

## Authentication

### Methods
1. **Email/Password** - Primary authentication method
   - Passwords hashed with bcrypt (12 rounds)
   - Email verification required before first login
   - Verification tokens expire after 24 hours

2. **OAuth Providers** (Optional)
   - Google OAuth
   - GitHub OAuth
   - Automatically creates user accounts on first login

### Session Management
- **Strategy**: JWT-based sessions (NextAuth v4)
- **Storage**: SQLite database for session persistence
- **Middleware**: All routes except `/auth/*` and `/api/auth/*` require authentication
- **Redirect**: Unauthenticated users are redirected to `/auth/signin`

## Data Model & User Isolation

### Database Schema Hierarchy

```
User (id, email, password_hash, name, email_verified)
  └─ Subject (id, user_id, name, syllabus_content)
      ├─ PastPaper (id, subject_id, name, content)
      └─ PaperType (id, subject_id, name)
          └─ Topic (id, paper_type_id, name, description)
              └─ Question (id, topic_id, question_text, summary)
                  └─ UserProgress (id, user_id, question_id, score, attempts)
```

### Ownership & Isolation

**Each user's workspace is completely isolated:**

1. **Subject Ownership**
   - Each subject has a `user_id` foreign key
   - Users can only create/read/update/delete their own subjects
   - Verified at API level in `/api/subjects/*`

2. **Cascading Ownership**
   - Past papers, paper types, topics, and questions inherit ownership through their parent subject
   - The ownership chain: `User → Subject → [PastPaper, PaperType] → Topic → Question`

3. **Independent Progress Tracking**
   - `user_progress` table links users directly to questions
   - Each user maintains separate progress (score, attempts) for the same question
   - **Future feature**: Users will be able to access shared subjects while retaining individual progress

### Example: Multiple Users, Same Question

```sql
-- User A creates subject "Mathematics"
INSERT INTO subjects (user_id, name) VALUES (1, 'Mathematics');

-- User B creates their own subject "Mathematics"
INSERT INTO subjects (user_id, name) VALUES (2, 'Mathematics');

-- Both can have topics with same questions, but:
-- 1. Questions are separate records (different IDs)
-- 2. Progress is tracked separately in user_progress table

-- User A's progress
INSERT INTO user_progress (user_id, question_id, score, attempts)
VALUES (1, 42, 85, 3);

-- User B's progress (same question concept, different question_id)
INSERT INTO user_progress (user_id, question_id, score, attempts)
VALUES (2, 108, 92, 2);
```

## API Security

### Ownership Verification at Every Level

All API endpoints verify ownership through the entire hierarchy:

#### 1. **Subject Endpoints** (`/api/subjects`)
```typescript
// Verify direct ownership
SELECT * FROM subjects WHERE id = ? AND user_id = ?
```

#### 2. **Paper Type Endpoints** (`/api/subjects/[id]/paper-types`)
```typescript
// Verify user owns the parent subject
SELECT * FROM subjects WHERE id = ? AND user_id = ?
```

#### 3. **Topic Endpoints** (`/api/paper-types/[id]/topics`)
```typescript
// Verify ownership through paper_type → subject chain
SELECT s.user_id
FROM paper_types pt
JOIN subjects s ON pt.subject_id = s.id
WHERE pt.id = ?
```

#### 4. **Question Endpoints** (`/api/topics/[id]/questions`)
```typescript
// Verify ownership through topic → paper_type → subject chain
SELECT s.user_id
FROM topics t
JOIN paper_types pt ON t.paper_type_id = pt.id
JOIN subjects s ON pt.subject_id = s.id
WHERE t.id = ?
```

#### 5. **Progress Endpoints** (`/api/progress`)
```typescript
// Verify ownership through question → topic → paper_type → subject chain
SELECT s.user_id
FROM questions q
JOIN topics t ON q.topic_id = t.id
JOIN paper_types pt ON t.paper_type_id = pt.id
JOIN subjects s ON pt.subject_id = s.id
WHERE q.id = ?
```

### Security Guarantees

✅ **Users cannot access other users' subjects**
- All subject queries filtered by `user_id`

✅ **Users cannot access other users' papers, topics, or questions**
- Ownership verified through JOIN queries up the hierarchy

✅ **Users cannot modify other users' progress**
- Progress updates require ownership of the parent subject

✅ **All routes protected by authentication**
- Middleware redirects unauthenticated users to `/auth/signin`

✅ **SQL injection prevention**
- All queries use parameterized statements (`?` placeholders)

## Route Protection

### Middleware Configuration

**Protected Routes** (require authentication):
- `/` (home page)
- `/subject/*`
- All other application routes

**Public Routes** (no authentication required):
- `/auth/signin`
- `/auth/signup`
- `/auth/verify-email`
- `/auth/verify-request`
- `/auth/reset-password`
- `/api/auth/*` (NextAuth routes)
- Static assets (`_next/static`, `_next/image`, `favicon.ico`, `exammer.png`)

### Implementation
```typescript
// middleware.ts
import { withAuth } from 'next-auth/middleware';

export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
  pages: {
    signIn: '/auth/signin',
  },
});

export const config = {
  matcher: [
    '/((?!auth|api/auth|_next/static|_next/image|favicon.ico|exammer.png).*)',
  ],
};
```

## Future Enhancements

### Planned: Subject Sharing

In a future version, users will be able to:
1. **Share subjects** with other users (read-only or collaborative)
2. **Access shared subjects** while maintaining independent progress
3. **Collaborate** on building question banks

**Implementation approach:**
- Add `subject_access` table: `(id, subject_id, user_id, permission_level)`
- Modify API ownership checks to include shared subjects
- Keep `user_progress` per-user for all questions

### Example: Future Shared Access

```sql
-- Subject owner
INSERT INTO subjects (user_id, name) VALUES (1, 'Physics A-Level');

-- Grant read access to User 2
INSERT INTO subject_access (subject_id, user_id, permission_level)
VALUES (1, 2, 'read');

-- Both users can access the same questions
SELECT * FROM questions WHERE topic_id IN (
  SELECT id FROM topics WHERE paper_type_id IN (
    SELECT id FROM paper_types WHERE subject_id = 1
  )
);

-- But each has independent progress
-- User 1's progress
INSERT INTO user_progress (user_id, question_id, score) VALUES (1, 42, 78);

-- User 2's progress (same question, different score)
INSERT INTO user_progress (user_id, question_id, score) VALUES (2, 42, 91);
```

## Testing Security

### Recommended Security Tests

1. **Test authentication requirement**
   ```bash
   # Should redirect to /auth/signin
   curl -I http://localhost:8933/
   ```

2. **Test user isolation**
   - Create two accounts
   - Create a subject with User A
   - Try to access User A's subject ID with User B's credentials
   - Should return 404 (not 403, to prevent information disclosure)

3. **Test ownership verification**
   - Create subject as User A (subject_id = 1)
   - Create paper_type as User B with subject_id = 1
   - Should fail with 404

4. **Test progress isolation**
   - Create question as User A (question_id = 42)
   - Update progress as User B for question_id = 42
   - Should fail with 404

## Environment Variables

**Required:**
```env
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
NEXTAUTH_URL=http://localhost:8933
```

**Optional (for OAuth):**
```env
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
GITHUB_CLIENT_ID=<github-oauth-client-id>
GITHUB_CLIENT_SECRET=<github-oauth-client-secret>
```

**Optional (for email):**
```env
EMAIL_SERVER=smtp://username:password@smtp.example.com:587
EMAIL_FROM=noreply@exammer.com
```

## Database Security

### Best Practices Implemented

1. **Foreign key constraints** - Enforce referential integrity
2. **Cascading deletes** - Remove orphaned data when users/subjects are deleted
3. **Indexes** - Optimize query performance on foreign keys
4. **Parameterized queries** - Prevent SQL injection
5. **Password hashing** - bcrypt with 12 rounds (never store plaintext)

### Database File Location
- **Path**: `./exammer.db` (project root)
- **Permissions**: Should be readable/writable only by application user
- **Backups**: Recommended for production deployments

## Contact

For security concerns or to report vulnerabilities, please create an issue at:
https://github.com/your-org/exammer/issues
