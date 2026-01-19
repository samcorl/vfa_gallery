# Data Models Specification
## You Should Be In . Pictures

All tables use CloudFlare D1 (SQLite-compatible). UUIDs for primary keys, timestamps for auditing.

---

## Core Entities

### User
Primary account entity, created via SSO.

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,                    -- UUID
  email TEXT UNIQUE NOT NULL,             -- From SSO provider
  username TEXT UNIQUE NOT NULL,          -- Public display name (slug-compatible)
  display_name TEXT,                      -- Friendly display name
  avatar_url TEXT,                        -- R2 URL or external
  bio TEXT,                               -- Artist bio
  website TEXT,
  phone TEXT,
  socials JSONB,                          -- { instagram, twitter, etc. }

  -- Status & Limits
  status TEXT DEFAULT 'pending',          -- pending, active, suspended, deactivated
  role TEXT DEFAULT 'user',               -- user, admin
  gallery_limit INTEGER DEFAULT 500,
  collection_limit INTEGER DEFAULT 1000,
  artwork_limit INTEGER DEFAULT 5000,
  daily_upload_limit INTEGER DEFAULT 10,

  -- Timestamps
  email_verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP
);
```

### Group
Organization/company that users can belong to.

```sql
CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  website TEXT,
  email TEXT,
  phone TEXT,
  socials JSONB,
  logo_url TEXT,

  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE group_members (
  group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',             -- member, admin, owner
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, user_id)
);
```

### Gallery
Top-level container for collections. Scoped to an artist.

```sql
CREATE TABLE galleries (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,                     -- Unique within user scope
  name TEXT NOT NULL,
  description TEXT,
  welcome_message TEXT,                   -- Gallery welcome content
  theme_id TEXT REFERENCES themes(id),

  is_default BOOLEAN DEFAULT FALSE,       -- "my-gallery" for private testing
  status TEXT DEFAULT 'active',           -- active, archived, hidden

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, slug)
);
```

### Collection
Container for artworks within a gallery.

```sql
CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  gallery_id TEXT REFERENCES galleries(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,                     -- Unique within gallery scope
  name TEXT NOT NULL,
  description TEXT,
  hero_image_url TEXT,                    -- Collection welcome hero
  theme_id TEXT REFERENCES themes(id),

  is_default BOOLEAN DEFAULT FALSE,       -- "my-collection" for private testing
  status TEXT DEFAULT 'active',           -- active, archived, hidden

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(gallery_id, slug)
);
```

### Artwork
Individual art pieces with associated images.

```sql
CREATE TABLE artworks (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,                     -- Unique within user scope

  -- Metadata
  title TEXT NOT NULL,
  description TEXT,
  materials TEXT,                         -- Medium, materials used
  dimensions TEXT,                        -- Physical dimensions if applicable
  created_date TEXT,                      -- When artwork was created (flexible format)
  category TEXT,                          -- manga, comic, illustration, etc.
  tags JSONB,                             -- Searchable tags

  -- Images (R2 URLs)
  original_url TEXT NOT NULL,             -- Original upload (not public)
  display_url TEXT NOT NULL,              -- Watermarked display version
  thumbnail_url TEXT NOT NULL,            -- Grid thumbnail
  icon_url TEXT NOT NULL,                 -- Small icon/preview

  theme_id TEXT REFERENCES themes(id),
  status TEXT DEFAULT 'active',           -- active, hidden, flagged, deleted
  is_featured BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, slug)
);

-- Junction table for artwork placement in collections
CREATE TABLE collection_artworks (
  collection_id TEXT REFERENCES collections(id) ON DELETE CASCADE,
  artwork_id TEXT REFERENCES artworks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,              -- Display order
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (collection_id, artwork_id)
);
```

### Theme
Styling configuration for galleries, collections, and artworks.

```sql
CREATE TABLE themes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,

  -- Ownership
  created_by TEXT REFERENCES users(id),   -- NULL for system themes
  is_system BOOLEAN DEFAULT FALSE,        -- Read-only system themes
  is_public BOOLEAN DEFAULT FALSE,        -- Shareable with other users
  copied_from TEXT REFERENCES themes(id), -- If copied from another theme

  -- Styling (JSONB for flexibility)
  styles JSONB NOT NULL,                  -- Colors, fonts, layout options

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Messaging System

### Message
User-to-user and user-to-admin messaging.

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,

  sender_id TEXT REFERENCES users(id),
  recipient_id TEXT REFERENCES users(id),

  -- Context (what is this message about?)
  context_type TEXT,                      -- artist, gallery, collection, artwork, general
  context_id TEXT,                        -- ID of related entity

  subject TEXT,
  body TEXT NOT NULL,

  -- Moderation
  status TEXT DEFAULT 'sent',             -- sent, pending_review, approved, rejected
  tone_score REAL,                        -- Automated tone analysis score
  flagged_reason TEXT,                    -- Why it was flagged (if applicable)
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TIMESTAMP,

  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_recipient ON messages(recipient_id, created_at);
CREATE INDEX idx_messages_status ON messages(status) WHERE status = 'pending_review';
```

---

## Gallery Roles

```sql
CREATE TABLE gallery_roles (
  gallery_id TEXT REFERENCES galleries(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                     -- creator, admin
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  granted_by TEXT REFERENCES users(id),
  PRIMARY KEY (gallery_id, user_id)
);
```

---

## Audit & Activity

```sql
CREATE TABLE activity_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,                   -- upload, create_gallery, login, etc.
  entity_type TEXT,                       -- artwork, gallery, collection, etc.
  entity_id TEXT,
  metadata JSONB,                         -- Additional context
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_user ON activity_log(user_id, created_at);
CREATE INDEX idx_activity_action ON activity_log(action, created_at);
```

---

## Sessions (if needed beyond SSO)

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
```

---

## Indexes Summary

Key indexes for common queries:
- User lookup by email, username
- Gallery/Collection/Artwork by slug within scope
- Messages by recipient and status
- Activity log by user and action type
- Featured artworks for browse page
