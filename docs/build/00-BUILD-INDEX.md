# Build Index
## VFA.gallery - Step-by-Step Build Instructions

Each file is a self-contained unit with specs, prerequisites, steps, and verification.

---

## ✅ Phase 1: Project Foundation (01-05)

| # | File | Deliverable |
|---|------|-------------|
| 01 | PROJECT-SCAFFOLD.md | Vite + React + TypeScript (strict) |
| 02 | TAILWIND-SETUP.md | Tailwind CSS configuration |
| 03 | CLOUDFLARE-PAGES-INIT.md | Pages project + wrangler.toml |
| 04 | D1-DATABASE-INIT.md | D1 database binding + migration tooling |
| 05 | R2-BUCKET-INIT.md | R2 bucket binding |

---

## ✅ Phase 2: Database Schema (06-14)

| # | File | Deliverable |
|---|------|-------------|
| 06 | SCHEMA-USERS.md | users table |
| 07 | SCHEMA-GROUPS.md | groups + group_members tables |
| 08 | SCHEMA-GALLERIES.md | galleries table |
| 09 | SCHEMA-COLLECTIONS.md | collections table |
| 10 | SCHEMA-ARTWORKS.md | artworks + collection_artworks tables |
| 11 | SCHEMA-THEMES.md | themes table |
| 12 | SCHEMA-MESSAGES.md | messages table |
| 13 | SCHEMA-SUPPORTING.md | gallery_roles, activity_log, sessions tables |
| 14 | SCHEMA-INDEXES.md | All performance indexes |

---

## ✅ Phase 3: API Foundation (15-17)

| # | File | Deliverable |
|---|------|-------------|
| 15 | API-FOUNDATION.md | Hono router setup, error handling, shared types |
| 16 | API-MIDDLEWARE-AUTH.md | Auth middleware (JWT validation) |
| 17 | API-MIDDLEWARE-COMMON.md | CORS, rate limiting, request logging |

---

## ✅ Phase 4: Authentication (18-23)

| # | File | Deliverable |
|---|------|-------------|
| 18 | AUTH-GOOGLE-SSO-REDIRECT.md | Google OAuth initiation endpoint |
| 19 | AUTH-GOOGLE-SSO-CALLBACK.md | Google OAuth callback + user creation |
| 20 | AUTH-JWT-GENERATION.md | JWT token creation + httpOnly cookie |
| 21 | AUTH-SESSION-MANAGEMENT.md | Session validation + refresh |
| 22 | AUTH-LOGOUT.md | Logout endpoint + cookie clearing |
| 23 | AUTH-TURNSTILE.md | CloudFlare Turnstile CAPTCHA |

---

## ✅ Phase 5: React Foundation (24-29)

| # | File | Deliverable |
|---|------|-------------|
| 24 | REACT-ROUTER-SETUP.md | React Router with route structure |
| 25 | REACT-AUTH-CONTEXT.md | Auth context provider + useAuth hook |
| 26 | REACT-PROTECTED-ROUTES.md | Protected route wrapper component |
| 27 | REACT-LAYOUT-SHELL.md | App shell with nav (mobile bottom, desktop top) |
| 28 | REACT-TOAST-SYSTEM.md | Toast notification component |
| 29 | REACT-ERROR-BOUNDARY.md | Error boundary + fallback UI |

---

## ✅ Phase 6: User Profile (30-35)

| # | File | Deliverable |
|---|------|-------------|
| 30 | API-USER-ME.md | GET /api/auth/me endpoint |
| 31 | API-USER-UPDATE.md | PATCH /api/users/me endpoint |
| 32 | API-USER-AVATAR.md | POST /api/users/me/avatar (R2 upload) |
| 33 | UI-PROFILE-VIEW.md | Profile page display |
| 34 | UI-PROFILE-EDIT.md | Profile edit form |
| 35 | UI-PROFILE-SOCIALS.md | Social links configuration |

---

## ✅ Phase 7: Image Pipeline (36-40)

| # | File | Deliverable |
|---|------|-------------|
| 36 | WORKER-IMAGE-UPLOAD-URL.md | Presigned R2 upload URL generation |
| 37 | WORKER-IMAGE-THUMBNAIL.md | Thumbnail generation (Worker) |
| 38 | WORKER-IMAGE-ICON.md | Icon generation (Worker) |
| 39 | WORKER-IMAGE-WATERMARK.md | Watermark overlay (Worker) |
| 40 | IMAGE-PIPELINE-ORCHESTRATION.md | Full upload flow orchestration |

---

## ✅ Phase 8: Artwork CRUD (41-47)

| # | File | Deliverable |
|---|------|-------------|
| 41 | API-ARTWORK-CREATE.md | POST /api/artworks endpoint |
| 42 | API-ARTWORK-LIST.md | GET /api/artworks (user's artworks) |
| 43 | API-ARTWORK-GET.md | GET /api/artworks/:id endpoint |
| 44 | API-ARTWORK-UPDATE.md | PATCH /api/artworks/:id endpoint |
| 45 | API-ARTWORK-DELETE.md | DELETE /api/artworks/:id (soft delete) |
| 46 | API-ARTWORK-REPLACE-IMAGE.md | POST /api/artworks/:id/replace-image |
| 47 | UI-ARTWORK-UPLOAD.md | Upload artwork page + form |

---

## ✅ Phase 9: Artwork UI (48-51)

| # | File | Deliverable |
|---|------|-------------|
| 48 | UI-ARTWORK-GRID.md | Artwork grid component (reusable) |
| 49 | UI-MY-ARTWORKS.md | My artworks page with filters |
| 50 | UI-ARTWORK-EDIT.md | Artwork edit page |
| 51 | UI-ARTWORK-CARD.md | Artwork card component |

---

## ✅ Phase 10: Gallery CRUD (52-58)

| # | File | Deliverable |
|---|------|-------------|
| 52 | API-GALLERY-CREATE.md | POST /api/galleries endpoint |
| 53 | API-GALLERY-LIST.md | GET /api/galleries (user's galleries) |
| 54 | API-GALLERY-GET.md | GET /api/galleries/:id endpoint |
| 55 | API-GALLERY-UPDATE.md | PATCH /api/galleries/:id endpoint |
| 56 | API-GALLERY-DELETE.md | DELETE /api/galleries/:id endpoint |
| 57 | API-GALLERY-DEFAULT.md | Auto-create default gallery on signup |
| 58 | UI-MY-GALLERIES.md | My galleries page |

---

## ✅ Phase 11: Gallery UI (59-62)

| # | File | Deliverable |
|---|------|-------------|
| 59 | UI-GALLERY-CREATE.md | Gallery creation form |
| 60 | UI-GALLERY-EDIT.md | Gallery edit page |
| 61 | UI-GALLERY-CARD.md | Gallery card component |
| 62 | UI-GALLERY-MANAGER.md | Gallery manager (collections list) |

---

## ✅ Phase 12: Collection CRUD (63-70)

| # | File | Deliverable |
|---|------|-------------|
| 63 | API-COLLECTION-CREATE.md | POST /api/galleries/:id/collections |
| 64 | API-COLLECTION-LIST.md | GET /api/galleries/:id/collections |
| 65 | API-COLLECTION-GET.md | GET /api/collections/:id |
| 66 | API-COLLECTION-UPDATE.md | PATCH /api/collections/:id |
| 67 | API-COLLECTION-DELETE.md | DELETE /api/collections/:id |
| 68 | API-COLLECTION-COPY.md | POST /api/collections/:id/copy |
| 69 | API-COLLECTION-DEFAULT.md | Auto-create default collection |
| 70 | UI-COLLECTION-MANAGER.md | Collection manager page |

---

## ✅ Phase 13: Collection-Artwork Management (71-75)

| # | File | Deliverable |
|---|------|-------------|
| 71 | API-COLLECTION-ARTWORKS-ADD.md | POST /api/collections/:id/artworks |
| 72 | API-COLLECTION-ARTWORKS-REMOVE.md | DELETE /api/collections/:id/artworks/:artworkId |
| 73 | API-COLLECTION-ARTWORKS-REORDER.md | PATCH /api/collections/:id/artworks/reorder |
| 74 | UI-COLLECTION-ARTWORK-GRID.md | Artwork grid in collection manager |
| 75 | UI-COLLECTION-REORDER.md | Drag-drop (desktop) + long-press (mobile) reorder |

---

## ✅ Phase 14: Public Views - Artist (76-79)

| # | File | Deliverable |
|---|------|-------------|
| 76 | API-PUBLIC-USER.md | GET /api/users/:username |
| 77 | API-PUBLIC-USER-GALLERIES.md | GET /api/users/:username/galleries |
| 78 | UI-PUBLIC-ARTIST.md | Public artist profile page |
| 79 | UI-PUBLIC-ARTIST-GALLERIES.md | Public galleries list on artist page |

---

## ✅ Phase 15: Public Views - Gallery (80-83)

| # | File | Deliverable |
|---|------|-------------|
| 80 | API-PUBLIC-GALLERY.md | GET /api/g/:artist/:gallery |
| 81 | UI-PUBLIC-GALLERY.md | Public gallery page |
| 82 | UI-PUBLIC-GALLERY-COLLECTIONS.md | Collections grid on gallery page |
| 83 | UI-GALLERY-MAP.md | Gallery sitemap component |

---

## ✅ Phase 16: Public Views - Collection (84-87)

| # | File | Deliverable |
|---|------|-------------|
| 84 | API-PUBLIC-COLLECTION.md | GET /api/g/:artist/:gallery/:collection |
| 85 | UI-PUBLIC-COLLECTION.md | Public collection page |
| 86 | UI-PUBLIC-COLLECTION-HERO.md | Collection hero image display |
| 87 | UI-PUBLIC-COLLECTION-NAV.md | Prev/next collection navigation |

---

## ✅ Phase 17: Public Views - Artwork (88-92)

| # | File | Deliverable |
|---|------|-------------|
| 88 | API-PUBLIC-ARTWORK.md | GET /api/g/:artist/:gallery/:collection/:artwork |
| 89 | UI-PUBLIC-ARTWORK.md | Public artwork detail page |
| 90 | UI-ARTWORK-ZOOM.md | Tap-to-zoom on mobile |
| 91 | UI-ARTWORK-SHARE.md | Share buttons component |
| 92 | UI-ARTWORK-MESSAGE-ARTIST.md | "Message Artist" button |

---

## ✅ Phase 18: Browse & Homepage (93-99)

| # | File | Deliverable |
|---|------|-------------|
| 93 | API-BROWSE-FEATURED.md | GET /api/browse/featured |
| 94 | API-BROWSE-RECENT.md | GET /api/browse/recent |
| 95 | API-BROWSE-CATEGORIES.md | GET /api/browse/categories |
| 96 | UI-HOMEPAGE.md | Homepage with hero + featured |
| 97 | UI-BROWSE-PAGE.md | Browse page with filters |
| 98 | UI-BROWSE-INFINITE-SCROLL.md | Infinite scroll implementation |
| 99 | UI-FEATURED-CAROUSEL.md | Featured artists carousel |

---

## ✅ Phase 19: Search (100-104)

| # | File | Deliverable |
|---|------|-------------|
| 100 | API-SEARCH.md | GET /api/search with filters |
| 101 | UI-SEARCH-PAGE.md | Search page layout |
| 102 | UI-SEARCH-AUTOCOMPLETE.md | Artist name autocomplete |
| 103 | UI-SEARCH-FILTERS.md | Filter controls |
| 104 | UI-SEARCH-EMPTY-STATE.md | No results + suggestions |

---

## ✅ Phase 20: Themes (105-112)

| # | File | Deliverable |
|---|------|-------------|
| 105 | API-THEME-LIST.md | GET /api/themes (public + system) |
| 106 | API-THEME-MINE.md | GET /api/themes/mine |
| 107 | API-THEME-CREATE.md | POST /api/themes |
| 108 | API-THEME-UPDATE.md | PATCH /api/themes/:id |
| 109 | API-THEME-DELETE.md | DELETE /api/themes/:id |
| 110 | API-THEME-COPY.md | POST /api/themes/:id/copy |
| 111 | UI-THEME-PICKER.md | Theme picker component |
| 112 | UI-THEME-PREVIEW.md | Theme preview component |

---

## ✅ Phase 21: Messaging (113-120)

| # | File | Deliverable |
|---|------|-------------|
| 113 | API-MESSAGE-SEND.md | POST /api/messages |
| 114 | API-MESSAGE-LIST.md | GET /api/messages |
| 115 | API-MESSAGE-GET.md | GET /api/messages/:id |
| 116 | API-MESSAGE-READ.md | PATCH /api/messages/:id/read |
| 117 | API-MESSAGE-DELETE.md | DELETE /api/messages/:id |
| 118 | UI-MESSAGES-INBOX.md | Messages inbox page |
| 119 | UI-MESSAGE-COMPOSE.md | Message compose form |
| 120 | UI-MESSAGE-THREAD.md | Message thread view |

---

## ✅ Phase 22: Groups (121-128)

| # | File | Deliverable |
|---|------|-------------|
| 121 | API-GROUP-CREATE.md | POST /api/groups |
| 122 | API-GROUP-LIST.md | GET /api/groups |
| 123 | API-GROUP-GET.md | GET /api/groups/:slug |
| 124 | API-GROUP-UPDATE.md | PATCH /api/groups/:id |
| 125 | API-GROUP-DELETE.md | DELETE /api/groups/:id |
| 126 | API-GROUP-MEMBERS.md | Member management endpoints |
| 127 | UI-GROUP-PUBLIC.md | Group public page |
| 128 | UI-GROUP-MANAGE.md | Group management page |

---

## Phase 23: Gallery Roles (129-132) ✅

| # | File | Deliverable |
|---|------|-------------|
| 129 | API-GALLERY-ROLES-LIST.md | GET /api/galleries/:id/roles |
| 130 | API-GALLERY-ROLES-ADD.md | POST /api/galleries/:id/roles |
| 131 | API-GALLERY-ROLES-REMOVE.md | DELETE /api/galleries/:id/roles/:userId |
| 132 | UI-GALLERY-ROLES.md | Role management UI |

---

## Phase 24: Admin - Foundation (133-136) ✅

| # | File | Deliverable |
|---|------|-------------|
| 133 | API-ADMIN-MIDDLEWARE.md | Admin role check middleware |
| 134 | API-ADMIN-STATS.md | GET /api/admin/stats |
| 135 | API-ADMIN-ACTIVITY.md | GET /api/admin/activity |
| 136 | UI-ADMIN-DASHBOARD.md | Admin dashboard page |

---

## Phase 25: Admin - Users (137-142) ✅

| # | File | Deliverable |
|---|------|-------------|
| 137 | API-ADMIN-USERS-LIST.md | GET /api/admin/users |
| 138 | API-ADMIN-USERS-GET.md | GET /api/admin/users/:id |
| 139 | API-ADMIN-USERS-UPDATE.md | PATCH /api/admin/users/:id |
| 140 | API-ADMIN-USERS-SUSPEND.md | POST /api/admin/users/:id/suspend |
| 141 | API-ADMIN-USERS-ACTIVATE.md | POST /api/admin/users/:id/activate |
| 142 | UI-ADMIN-USERS.md | User management table + detail |

---

## Phase 26: Admin - Moderation (143-146) ✅

| # | File | Deliverable |
|---|------|-------------|
| 143 | API-ADMIN-MESSAGES-PENDING.md | GET /api/admin/messages/pending |
| 144 | API-ADMIN-MESSAGES-APPROVE.md | POST /api/admin/messages/:id/approve |
| 145 | API-ADMIN-MESSAGES-REJECT.md | POST /api/admin/messages/:id/reject |
| 146 | UI-ADMIN-MODERATION.md | Moderation queue page |

---

## ✅ Phase 27: Rate Limiting & Security (147-151)

| # | File | Deliverable |
|---|------|-------------|
| 147 | SECURITY-NEW-ACCOUNT-LIMITS.md | 10 uploads/day for first 7 days |
| 148 | SECURITY-RATE-LIMITING.md | Global rate limiting |
| 149 | SECURITY-ACTIVITY-LOGGING.md | Activity log writes |
| 150 | SECURITY-SUSPICIOUS-DETECTION.md | Rapid upload / duplicate detection |
| 151 | SECURITY-EMAIL-VERIFICATION.md | Email verification flow |

---

## ✅ Phase 28: Social Sharing (152-155)

| # | File | Deliverable |
|---|------|-------------|
| 152 | SEO-OPEN-GRAPH.md | Open Graph meta tags |
| 153 | SEO-TWITTER-CARDS.md | Twitter Card meta tags |
| 154 | UI-SHARE-BUTTONS.md | Share buttons component |
| 155 | UI-NATIVE-SHARE.md | Native share API (mobile) |

---

## ✅ Phase 29: Ads (156-157)

| # | File | Deliverable |
|---|------|-------------|
| 156 | ADS-SLOT-COMPONENT.md | Ad slot component |
| 157 | ADS-FOOTER-PLACEMENT.md | Footer ad integration |

---

## Phase 30: Polish (158-165)

| # | File | Deliverable |
|---|------|-------------|
| 158 | POLISH-LAZY-LOADING.md | Image lazy loading |
| 159 | POLISH-SKELETON-LOADERS.md | Skeleton loader components |
| 160 | POLISH-OPTIMISTIC-UI.md | Optimistic updates |
| 161 | POLISH-BUNDLE-SPLITTING.md | Code splitting |
| 162 | A11Y-KEYBOARD-NAV.md | Keyboard navigation |
| 163 | A11Y-SCREEN-READER.md | Screen reader support |
| 164 | A11Y-COLOR-CONTRAST.md | Color contrast verification |
| 165 | A11Y-TOUCH-TARGETS.md | Touch target sizing |

---

## Phase 31: Admin Scripts - Ruby (166-170)

| # | File | Deliverable |
|---|------|-------------|
| 166 | SCRIPT-USER-MANAGEMENT.md | User listing/search script |
| 167 | SCRIPT-BULK-STATUS.md | Bulk user status update |
| 168 | SCRIPT-DB-BACKUP.md | Database backup script |
| 169 | SCRIPT-ANALYTICS-EXPORT.md | Analytics export script |
| 170 | SCRIPT-ORPHAN-CLEANUP.md | Orphaned artwork cleanup |

---

## Phase 32: E2E Testing — Playwright (171-174)

| # | File | Deliverable |
|---|------|-------------|
| 171 | E2E-PLAYWRIGHT-SETUP.md | Playwright install, config, auth bypass, MCP server |
| 172 | E2E-PUBLIC-BROWSING-FLOWS.md | Homepage, browse, search, artist, artwork tests |
| 173 | E2E-ARTIST-MANAGEMENT-FLOWS.md | Profile, gallery, collection, artwork CRUD tests |
| 174 | E2E-SOCIAL-MESSAGING-FLOWS.md | Share buttons, messaging, groups, mobile social tests |

---

## Total: 174 build files

Estimated time per file: varies (5 min for simple schema, 30+ min for complex UI)

---

## How to Use These Files

1. Open the build file for the step you're working on
2. Read the **Goal** and **Prerequisites**
3. Follow the **Steps** in order
4. Create/modify files as specified
5. Run the **Verification** checks
6. Move to the next file

Each file is designed to be handed to Haiku (or any AI assistant) as a standalone task.
