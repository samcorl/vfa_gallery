# Build 12: Database Schema - Messages Table

## Goal
Create the `messages` table in the D1 database to support user-to-user messaging with content moderation and flagging capabilities.

## Spec Extract

The messages table stores direct messages between users with support for context tracking (linking messages to specific artworks or galleries), tone analysis, and content moderation workflows.

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT REFERENCES users(id),
  recipient_id TEXT REFERENCES users(id),
  context_type TEXT,
  context_id TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  tone_score REAL,
  flagged_reason TEXT,
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  read_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Field Definitions:**
- `id`: Unique identifier for the message (primary key)
- `sender_id`: References the user who sent the message
- `recipient_id`: References the user who receives the message
- `context_type`: Optional type of context (e.g., 'artwork', 'gallery', 'collection')
- `context_id`: Optional ID of the contextual entity (artwork_id, gallery_id, etc.)
- `subject`: Optional subject line for the message
- `body`: The message content (required)
- `status`: Message status - 'sent', 'delivered', 'read', 'archived', etc. (default: 'sent')
- `tone_score`: Optional numeric score from sentiment analysis (range typically -1.0 to 1.0)
- `flagged_reason`: If flagged for moderation, the reason (null if not flagged)
- `reviewed_by`: References moderator/admin who reviewed a flagged message
- `reviewed_at`: Timestamp when a flagged message was reviewed
- `read_at`: Timestamp when the recipient read the message
- `created_at`: Timestamp of message creation (auto-generated)

## Prerequisites
- **Build 06**: Users table must exist before creating messages table

## Steps

### 1. Create Migration File

Create a new migration file in the migrations folder following Cloudflare D1 naming conventions:

```bash
File: migrations/[TIMESTAMP]_create_messages_table.sql
```

The timestamp should be in the format `YYYYMMDDHHMMSS` and should be sequential after previous migrations (e.g., `20260118220100`).

### 2. Migration Implementation

In the migration file, add the CREATE TABLE statement:

```sql
-- Create messages table for user-to-user messaging with moderation support
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT REFERENCES users(id),
  recipient_id TEXT REFERENCES users(id),
  context_type TEXT,
  context_id TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  tone_score REAL,
  flagged_reason TEXT,
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  read_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Notes on fields:
-- status: can be 'sent', 'delivered', 'read', 'archived', 'deleted'
-- tone_score: -1.0 (very negative) to 1.0 (very positive), NULL if not analyzed
-- context_type and context_id allow linking messages to specific artworks/galleries
-- flagged_reason: populated if message requires moderation review
```

### 3. Verify Migration File Structure

Ensure the migration file:
- Has a unique timestamp after all previous migrations
- Contains only valid SQLite syntax
- Includes the complete CREATE TABLE statement with all foreign key references
- Is placed in the `/migrations` directory at the project root
- Does not have any syntax errors

### 4. Apply Migration

Apply the migration using Wrangler:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
wrangler d1 migrations apply vfa_gallery_db --local
```

Or for production:
```bash
wrangler d1 migrations apply vfa_gallery_db --remote
```

### 5. Verify Table Structure

After migration succeeds, verify the table was created correctly:

```bash
wrangler d1 execute vfa_gallery_db --command "SELECT sql FROM sqlite_master WHERE type='table' AND name='messages';" --local
```

Expected output should show the complete CREATE TABLE statement.

## Files to Create/Modify

### Create:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/[TIMESTAMP]_create_messages_table.sql`

### Modify:
- None

## Verification

### 1. Verify Table Exists

Execute this command to confirm the messages table was created:

```bash
wrangler d1 execute vfa_gallery_db --command "SELECT name FROM sqlite_master WHERE type='table' AND name='messages';" --local
```

Expected result: One row with value `messages`

### 2. Verify Column Structure

Verify all columns exist with correct types and defaults:

```bash
wrangler d1 execute vfa_gallery_db --command "PRAGMA table_info(messages);" --local
```

Expected columns in order:
- id (TEXT)
- sender_id (TEXT)
- recipient_id (TEXT)
- context_type (TEXT)
- context_id (TEXT)
- subject (TEXT)
- body (TEXT)
- status (TEXT)
- tone_score (REAL)
- flagged_reason (TEXT)
- reviewed_by (TEXT)
- reviewed_at (TEXT)
- read_at (TEXT)
- created_at (TEXT)

### 3. Verify Foreign Keys

Check that foreign key constraints are properly configured:

```bash
wrangler d1 execute vfa_gallery_db --command "PRAGMA foreign_key_list(messages);" --local
```

Expected: Foreign key references to `users(id)` for:
- `sender_id` column
- `recipient_id` column
- `reviewed_by` column

### 4. Verify Default Values

Test that default values are applied correctly:

```bash
wrangler d1 execute vfa_gallery_db --command "
INSERT INTO messages (id, sender_id, recipient_id, body)
VALUES ('msg-001', (SELECT id FROM users LIMIT 1), (SELECT id FROM users LIMIT 1), 'Test message');
" --local
```

Then query to verify defaults were applied:

```bash
wrangler d1 execute vfa_gallery_db --command "
SELECT id, status, created_at FROM messages WHERE id='msg-001';
" --local
```

Expected: `status` should be 'sent' and `created_at` should be populated with current timestamp

### 5. Verify Nullable Fields

Verify that nullable fields work correctly:

```bash
wrangler d1 execute vfa_gallery_db --command "
INSERT INTO messages (id, sender_id, recipient_id, body)
VALUES ('msg-002', (SELECT id FROM users LIMIT 1), (SELECT id FROM users LIMIT 1), 'Message without context');
" --local
```

Query should succeed even though optional fields are not provided:

```bash
wrangler d1 execute vfa_gallery_db --command "SELECT context_type, subject, read_at FROM messages WHERE id='msg-002';" --local
```

Expected: All three fields should be NULL

### 6. Verify Constraints

Test that foreign key constraints work by attempting an invalid insert:

```bash
wrangler d1 execute vfa_gallery_db --command "
INSERT INTO messages (id, sender_id, recipient_id, body)
VALUES ('msg-invalid', 'nonexistent-user', 'another-invalid-user', 'Test');
" --local
```

This should fail with a foreign key constraint error if constraints are enabled.

### 7. Test Moderation Fields

Verify that moderation-related fields can be updated:

```bash
wrangler d1 execute vfa_gallery_db --command "
UPDATE messages
SET flagged_reason='Inappropriate language',
    status='flagged'
WHERE id='msg-001';
" --local
```

Query to verify update:

```bash
wrangler d1 execute vfa_gallery_db --command "SELECT status, flagged_reason FROM messages WHERE id='msg-001';" --local
```

## Notes

- The `status` field uses TEXT to allow flexibility. Consider a check constraint if only specific values should be allowed
- The `tone_score` field is REAL to store decimal values from sentiment analysis algorithms
- `context_type` and `context_id` work together to link messages to specific resources (e.g., context_type='artwork', context_id='art-123')
- The `flagged_reason` field is used when moderators identify content that violates guidelines
- Consider adding indexes in Build 14 for common queries (recipient, status, timestamp lookups)
- The `CURRENT_TIMESTAMP` default uses SQLite's format (YYYY-MM-DD HH:MM:SS)
- No automatic cascade delete from users - messages are preserved for audit/moderation purposes
