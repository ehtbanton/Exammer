# User Management with users.json

This application uses a file-based admin system for managing users. The `db/users.json` file is automatically synchronized with the database and provides a simple way to manage user access levels.

## How It Works

### Automatic Synchronization (Event-Driven)

1. **Database → File**: The `users.json` file is automatically updated whenever the database changes (new signups, modifications)
2. **File → Database**: When you edit `users.json`, changes are detected within 250ms and immediately applied to the database
3. **Session Management**: When users are modified or deleted, their sessions are invalidated immediately and connected clients are notified in real-time via Server-Sent Events (SSE)

### File Format

The `users.json` file contains an array of user objects:

```json
[
  {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "access_level": 0,
    "created_at": "01/15/2025, 14:30:45"
  }
]
```

**Fields:**
- `id`: User's unique ID (do not change)
- `email`: User's email address (do not change)
- `name`: User's display name (editable)
- `access_level`: Access level (editable - see below)
- `created_at`: Human-readable creation timestamp (do not change)

### Access Levels

- **0**: Pending/Restricted access (default for new signups)
- **1**: Full access (standard users)
- **2**: Full access (reserved for future premium features)
- **3**: Admin access (includes debug terminal at /t)

## Managing Users

### Grant Access to a User

1. Open `db/users.json`
2. Find the user by email
3. Change their `access_level` from `0` to `1`
4. Save the file
5. The database is automatically updated
6. The user's session is invalidated and they'll need to sign in again

**Example:**
```json
{
  "id": 5,
  "email": "newuser@example.com",
  "name": "New User",
  "access_level": 1,  // Changed from 0 to 1
  "created_at": "01/25/2025, 10:15:30"
}
```

### Revoke Access

1. Open `db/users.json`
2. Find the user
3. Change their `access_level` from `1` to `0`
4. Save the file
5. The user is immediately logged out

### Delete a User

1. Open `db/users.json`
2. Find the user's entry
3. Delete the entire user object (including the comma if needed)
4. Save the file
5. The user and all their data are deleted from the database

**Before:**
```json
[
  {
    "id": 1,
    "email": "keep@example.com",
    "name": "Keep User",
    "access_level": 1,
    "created_at": "01/15/2025, 14:30:45"
  },
  {
    "id": 2,
    "email": "delete@example.com",
    "name": "Delete User",
    "access_level": 0,
    "created_at": "01/20/2025, 09:20:15"
  }
]
```

**After:**
```json
[
  {
    "id": 1,
    "email": "keep@example.com",
    "name": "Keep User",
    "access_level": 1,
    "created_at": "01/15/2025, 14:30:45"
  }
]
```

### Update User Name

1. Open `db/users.json`
2. Find the user
3. Change their `name` field
4. Save the file

## Error Handling

### Invalid JSON or Data

If you make an error in `users.json`:
- The changes are **rejected**
- The file is **automatically replaced** with the current database state
- Check the server logs for detailed error messages

**Common mistakes that trigger auto-replacement:**
- **Syntax errors**: Missing comma, trailing comma, unquoted strings, missing brackets
- **Invalid structure**: Not an array, missing required fields
- **Invalid data types**: access_level is not a number
- **Missing fields**: User missing id, email, or access_level

**Example errors:**
```json
// ❌ Invalid - missing comma
[
  {"id": 1, "email": "user1@example.com", "access_level": 1}
  {"id": 2, "email": "user2@example.com", "access_level": 0}
]

// ❌ Invalid - access_level is a string
{"id": 3, "email": "user3@example.com", "access_level": "1"}

// ✅ Valid
[
  {"id": 1, "email": "user1@example.com", "name": "User 1", "access_level": 1, "created_at": "01/25/2025, 10:15:30"},
  {"id": 2, "email": "user2@example.com", "name": null, "access_level": 0, "created_at": "01/25/2025, 11:20:45"}
]
```

### Invalid Changes

The following changes are ignored:
- Changing `id` (user IDs are immutable)
- Changing `email` (emails are immutable)
- Changing `created_at` (timestamps are immutable)
- Adding new users (users must sign up through the app)

## Real-Time Updates

### For Affected Users

When a user's access level is changed or they're deleted:
1. Their session is immediately invalidated in the database
2. The server sends a real-time notification via Server-Sent Events (SSE)
3. All browser tabs/windows signed in as that user receive the notification instantly
4. Pages automatically refresh to reflect the new access level (or redirect to signin if deleted)

**Technical Details:**
- Uses Server-Sent Events (SSE) for real-time push notifications
- No polling or periodic checks required
- Instant notification delivery when session is invalidated
- Clients maintain a persistent connection to `/api/auth/session-events`
- Connection automatically closes on logout and reconnects on page load

**How It Works:**
1. File watcher detects `users.json` change (250ms debounce)
2. File is validated (JSON syntax, required fields, data types)
3. If invalid: File is automatically replaced with current database state
4. If valid: Database is updated immediately
5. Session invalidation triggers event listener
6. SSE pushes notification to all tabs/windows signed in as affected user
7. All tabs automatically refresh to reflect changes

### Monitoring Changes

Check the server logs to see sync activity:
```bash
pm2 logs exammer
```

You'll see messages like:
```
Synced 5 user(s) to users.json
users.json changed, syncing to database...
Updating user 3 (user@example.com) access_level from 0 to 1
Invalidating sessions for users: 3
```

## File Location

- **Local Development**: `./db/users.json`
- **Production Server**: `/path/to/exammer/db/users.json`

## Best Practices

1. **Always use a text editor** that validates JSON (VS Code, Sublime, etc.)
2. **Make one change at a time** to avoid confusion
3. **Check server logs** after making changes to confirm they were applied
4. **Keep backups** if you're making bulk changes
5. **Use a JSON formatter** to ensure proper syntax

## Security Notes

- The `users.json` file is **not committed to git** (it's in `.gitignore`)
- Only server administrators with file system access can edit it
- Changes are logged to the server console
- Session invalidation ensures immediate effect of changes

## Troubleshooting

### Changes Not Applying

1. Check server logs for errors
2. Verify JSON syntax with a JSON validator
3. Ensure the file is saved
4. Changes should apply within 250ms (file watcher debounce time)

### File Keeps Resetting

This happens when there's a syntax error. Fix the JSON syntax and try again.

### User Still Logged In

- The client uses Server-Sent Events for real-time notifications
- When access level changes, all browser tabs refresh instantly to show new permissions
- When user is deleted, all browser tabs refresh and redirect to signin
- If SSE connection is lost, changes apply on next page navigation
- Works across multiple browser tabs/windows simultaneously

## Example Workflow

### Approving a New User

1. User signs up → Gets `access_level: 0`
2. You receive notification (check `users.json`)
3. You verify the user is legitimate
4. Edit `users.json` and change their `access_level` to `1`
5. Save the file
6. User is granted access (their session is invalidated, they sign in again with full access)

### Banning a User

1. Open `users.json`
2. Change user's `access_level` from `1` to `0`
3. Or completely remove their entry to delete them
4. Save the file
5. User is immediately logged out and can't access the app

## Advanced Usage

### Bulk Changes

To approve multiple users at once:
1. Open `users.json` in a good text editor
2. Use find/replace: `"access_level": 0` → `"access_level": 1`
3. Review the changes carefully
4. Save the file
5. All affected users' pages refresh instantly with new access

### Filtering Users

To see only pending users:
```bash
cat db/users.json | jq '.[] | select(.access_level == 0)'
```

To count users by access level:
```bash
cat db/users.json | jq 'group_by(.access_level) | map({access_level: .[0].access_level, count: length})'
```

## API Alternative

While `users.json` is the recommended way to manage users, you can also use the programmatic API:

```typescript
import { updateUserAccessLevel } from '@/lib/user-access-sync';

// Grant access
await updateUserAccessLevel(userId, 1);

// Revoke access
await updateUserAccessLevel(userId, 0);
```

This is useful for building custom admin interfaces.
