# Implementation Checklist
## You Should Be In . Pictures

Ordered by dependency and priority. Check off as completed.

---

## Phase 1: Foundation

### Infrastructure Setup
- [ ] Configure CloudFlare Pages project
- [ ] Set up CloudFlare D1 database
- [ ] Set up CloudFlare R2 bucket
- [ ] Configure GitHub Actions for CI/CD
- [ ] Set up development environment (local D1, R2 mocking)
- [ ] Configure environment variables

### Database Schema
- [ ] Create users table
- [ ] Create groups and group_members tables
- [ ] Create galleries table
- [ ] Create collections table
- [ ] Create artworks table
- [ ] Create collection_artworks junction table
- [ ] Create themes table
- [ ] Create messages table
- [ ] Create gallery_roles table
- [ ] Create activity_log table
- [ ] Create sessions table
- [ ] Create all indexes
- [ ] Write seed data script (Ruby)

### Authentication
- [ ] Implement Google SSO flow
- [ ] Implement Apple SSO flow (optional, can defer)
- [ ] JWT token generation and validation
- [ ] Session management middleware
- [ ] Auth context provider (React)
- [ ] Protected route wrapper component
- [ ] CAPTCHA integration for registration
- [ ] Email verification flow

---

## Phase 2: Core User Features

### User Profile
- [ ] GET /api/auth/me endpoint
- [ ] PATCH /api/users/me endpoint
- [ ] Avatar upload (R2 integration)
- [ ] Profile page UI
- [ ] Profile edit form
- [ ] Socials configuration

### Image Processing Pipeline
- [ ] R2 presigned URL generation
- [ ] Client-side image upload to R2
- [ ] Thumbnail generation (CloudFlare Worker or client)
- [ ] Icon generation
- [ ] Watermark application (username overlay)
- [ ] Image size validation (5MB limit)

### Artwork CRUD
- [ ] POST /api/artworks/upload-url endpoint
- [ ] POST /api/artworks endpoint
- [ ] GET /api/artworks endpoint (user's artworks)
- [ ] GET /api/artworks/:id endpoint
- [ ] PATCH /api/artworks/:id endpoint
- [ ] DELETE /api/artworks/:id endpoint (soft delete)
- [ ] POST /api/artworks/:id/replace-image endpoint
- [ ] Upload artwork UI
- [ ] Artwork metadata form
- [ ] My artworks grid page
- [ ] Artwork edit page

### Gallery CRUD
- [ ] POST /api/galleries endpoint
- [ ] GET /api/galleries endpoint
- [ ] GET /api/galleries/:id endpoint
- [ ] PATCH /api/galleries/:id endpoint
- [ ] DELETE /api/galleries/:id endpoint
- [ ] Default "my-gallery" creation on signup
- [ ] My galleries grid page
- [ ] Gallery creation form
- [ ] Gallery edit page

### Collection CRUD
- [ ] POST /api/galleries/:id/collections endpoint
- [ ] GET /api/galleries/:id/collections endpoint
- [ ] GET /api/collections/:id endpoint
- [ ] PATCH /api/collections/:id endpoint
- [ ] DELETE /api/collections/:id endpoint
- [ ] POST /api/collections/:id/copy endpoint
- [ ] Default "my-collection" creation with default gallery
- [ ] Collections management page
- [ ] Collection creation form
- [ ] Collection edit page
- [ ] Hero image upload

### Collection-Artwork Management
- [ ] POST /api/collections/:id/artworks endpoint
- [ ] DELETE /api/collections/:id/artworks/:artworkId endpoint
- [ ] PATCH /api/collections/:id/artworks/reorder endpoint
- [ ] Artwork grid in collection manager
- [ ] Drag-and-drop reorder (desktop)
- [ ] Long-press reorder (mobile)
- [ ] Add artwork modal (from library)

---

## Phase 3: Public Views

### URL Routing
- [ ] React Router setup
- [ ] Artist profile route `/:artist`
- [ ] Gallery route `/:artist/:gallery`
- [ ] Collection route `/:artist/:gallery/:collection`
- [ ] Artwork route `/:artist/:gallery/:collection/:artwork`
- [ ] Slug resolution API endpoints

### Public Artist Profile
- [ ] GET /api/users/:username endpoint
- [ ] Artist profile page UI
- [ ] Galleries list on profile
- [ ] Avatar, bio, socials display

### Public Gallery View
- [ ] GET /api/g/:artist/:gallery endpoint
- [ ] Gallery welcome page UI
- [ ] Collections grid
- [ ] Gallery "map" (sitemap)
- [ ] Info desk search (defer if complex)

### Public Collection View
- [ ] GET /api/g/:artist/:gallery/:collection endpoint
- [ ] Collection page UI
- [ ] Hero image display
- [ ] Artwork grid (themed layout)
- [ ] Navigation between collections

### Public Artwork View
- [ ] GET /api/g/:artist/:gallery/:collection/:artwork endpoint
- [ ] Artwork detail page UI
- [ ] Full image display with zoom
- [ ] Metadata display
- [ ] Artist credit link
- [ ] Share buttons

---

## Phase 4: Browse & Search

### Browse Functionality
- [ ] GET /api/browse/featured endpoint
- [ ] GET /api/browse/recent endpoint
- [ ] GET /api/browse/categories endpoint
- [ ] GET /api/browse/categories/:category endpoint
- [ ] Homepage with featured artists
- [ ] Browse page with filters
- [ ] Category browsing
- [ ] Infinite scroll implementation

### Search Functionality
- [ ] GET /api/search endpoint with filters
- [ ] Search page UI
- [ ] Autocomplete for artist names
- [ ] Fuzzy matching implementation
- [ ] Search results grid
- [ ] Empty state handling

---

## Phase 5: Themes

### Theme System
- [ ] Create system themes (starter pack)
- [ ] GET /api/themes endpoint
- [ ] GET /api/themes/mine endpoint
- [ ] POST /api/themes endpoint
- [ ] PATCH /api/themes/:id endpoint
- [ ] DELETE /api/themes/:id endpoint
- [ ] POST /api/themes/:id/copy endpoint
- [ ] Theme picker component
- [ ] Theme inheritance logic (artwork < collection < gallery < artist)
- [ ] Theme preview component
- [ ] Theme editor (basic)

---

## Phase 6: Messaging

### Message System
- [ ] POST /api/messages endpoint
- [ ] GET /api/messages endpoint
- [ ] GET /api/messages/:id endpoint
- [ ] PATCH /api/messages/:id/read endpoint
- [ ] DELETE /api/messages/:id endpoint
- [ ] Tone scoring integration (non-LLM primary)
- [ ] Auto-flag suspicious messages
- [ ] Messages inbox UI
- [ ] Message compose UI
- [ ] Message thread UI
- [ ] Context linking (artwork/gallery references)

---

## Phase 7: Groups

### Group Features
- [ ] POST /api/groups endpoint
- [ ] GET /api/groups endpoint
- [ ] GET /api/groups/:slug endpoint
- [ ] PATCH /api/groups/:id endpoint
- [ ] DELETE /api/groups/:id endpoint
- [ ] Member management endpoints
- [ ] Group public page UI
- [ ] Group management UI
- [ ] Member invite flow

---

## Phase 8: Gallery Roles

### Role Management
- [ ] Gallery roles table implementation
- [ ] GET /api/galleries/:id/roles endpoint
- [ ] POST /api/galleries/:id/roles endpoint
- [ ] DELETE /api/galleries/:id/roles/:userId endpoint
- [ ] Role-based access checks in all gallery endpoints
- [ ] Role management UI (creator only)

---

## Phase 9: Admin Features

### Admin Dashboard
- [ ] Admin role check middleware
- [ ] GET /api/admin/stats endpoint
- [ ] GET /api/admin/activity endpoint
- [ ] Admin dashboard UI
- [ ] Activity feed component

### User Administration
- [ ] GET /api/admin/users endpoint
- [ ] GET /api/admin/users/:id endpoint
- [ ] PATCH /api/admin/users/:id endpoint
- [ ] POST /api/admin/users/:id/suspend endpoint
- [ ] POST /api/admin/users/:id/activate endpoint
- [ ] User management table UI
- [ ] User detail page UI
- [ ] Limit adjustment controls

### Message Moderation
- [ ] GET /api/admin/messages/pending endpoint
- [ ] POST /api/admin/messages/:id/approve endpoint
- [ ] POST /api/admin/messages/:id/reject endpoint
- [ ] Moderation queue UI
- [ ] Approve/reject workflow

### Admin Scripts (Ruby)
- [ ] User listing/search script
- [ ] Bulk user status update script
- [ ] Database backup script
- [ ] Analytics export script
- [ ] Orphaned artwork cleanup script

---

## Phase 10: Rate Limiting & Security

### Rate Limiting
- [ ] New account upload limits (10/day first week)
- [ ] Global rate limiting middleware
- [ ] Suspicious activity detection
- [ ] Activity logging to activity_log table

### Content Moderation
- [ ] Image moderation integration (TBD)
- [ ] Foul language detection for messages
- [ ] Duplicate image detection
- [ ] Rapid upload detection

---

## Phase 11: Social & Sharing

### Social Sharing
- [ ] Open Graph meta tags for all public pages
- [ ] Twitter Card meta tags
- [ ] Share buttons component
- [ ] Copy link functionality
- [ ] Native share API integration (mobile)

---

## Phase 12: Ads Integration

### Monetization
- [ ] Ad slot component
- [ ] Footer ad placement
- [ ] Ad provider integration (TBD)
- [ ] Ad-free development mode

---

## Phase 13: Polish & Optimization

### Performance
- [ ] Image lazy loading
- [ ] Skeleton loaders
- [ ] Optimistic UI updates
- [ ] Bundle splitting
- [ ] Service worker for offline support

### Accessibility
- [ ] Keyboard navigation audit
- [ ] Screen reader testing
- [ ] Color contrast verification
- [ ] Touch target size audit
- [ ] Alt text enforcement

### Testing
- [ ] Unit tests for utilities
- [ ] API endpoint tests
- [ ] Component tests
- [ ] E2E tests for critical flows
- [ ] Mobile device testing

### Documentation
- [ ] API documentation
- [ ] User guide
- [ ] Admin guide
- [ ] Developer onboarding guide

---

## Deferred / Future

- [ ] Apple SSO (if not done in Phase 1)
- [ ] Advanced theme editor
- [ ] Natural language gallery search (Info Desk)
- [ ] Terms of Service / AUP
- [ ] Premium tiers (if decided)
- [ ] Analytics dashboard
- [ ] Artist verification badges
- [ ] Commission request system
