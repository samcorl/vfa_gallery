# UI/UX Specification
## You Should Be In . Pictures

Mobile-first, minimalist design. Light-hearted and fun. Let the art speak for itself.

---

## Design Principles

1. **Mobile-First** - Design for phone screens first, enhance for desktop
2. **Minimalist** - Simple, elegant, uncluttered
3. **Art-Centric** - UI fades into background; artwork is hero
4. **Fun & Inviting** - Approachable, not intimidating
5. **Live-Edit** - Atomic operations, instant feedback, no page reloads
6. **Deep-Linkable** - Every state has a shareable URL

---

## Page Structure

### Public Pages (No Auth Required)

#### Homepage `/`
- Hero section with tagline and CTA
- Featured artists carousel
- Recently added artwork grid
- Simple footer with ads placement

#### Browse `/browse`
- Filter tabs: Featured | Recent | Categories
- Infinite scroll artwork grid
- Artist name overlay on hover/tap
- Click through to artwork detail

#### Search `/search`
- Search bar with autocomplete
- Filters: Artist, Category, Date Range
- Results as artwork grid
- "No results" state with suggestions

#### Artist Profile `/:artist`
- Avatar and display name
- Bio and socials
- Galleries grid
- Link to each gallery

#### Gallery `/:artist/:gallery`
- Gallery welcome message
- Featured collection promos
- Collections grid
- "Info Desk" - natural language search within gallery
- Gallery "map" (sitemap of collections)

#### Collection `/:artist/:gallery/:collection`
- Hero image
- Collection description
- Artwork grid (themed layout per collection settings)
- Navigation to prev/next collections

#### Artwork Detail `/:artist/:gallery/:collection/:artwork`
- Full artwork display (tap to zoom on mobile)
- Title, description, materials, date
- Artist credit with link
- Share buttons (Instagram, Facebook, etc.)
- "Message Artist" button (if logged in)

#### Group Page `/groups/:slug`
- Group logo and name
- Description and contact info
- Members list with avatars
- Link to each member's galleries

---

### Authenticated Pages

#### Profile `/profile`
- Edit avatar (camera + upload)
- Edit display name, bio, website
- Manage socials
- View stats (galleries, collections, artworks)

#### My Galleries `/profile/galleries`
- Grid of user's galleries
- "+ New Gallery" card
- Each card shows: name, collection count, last updated
- Tap to manage gallery

#### Gallery Manager `/profile/galleries/:id`
- Edit gallery details
- Manage collections list
- Reorder collections (drag & drop on desktop, long-press reorder on mobile)
- Add/remove gallery admins (creator only)
- Theme selector

#### Collection Manager `/profile/galleries/:gid/collections/:cid`
- Edit collection details
- Hero image upload
- Artwork grid with reorder capability
- Add artwork (from user's library or new upload)
- Remove artwork from collection
- Theme selector

#### My Artworks `/profile/artworks`
- Paginated grid of all user's artworks
- Filter by: In collection / Orphaned
- Bulk select for adding to collections
- Search within own artworks

#### Upload Artwork `/profile/artworks/new`
- Camera button (mobile) or file picker
- Drag & drop zone (desktop)
- Preview before upload
- Metadata form:
  - Title (required)
  - Description
  - Category (dropdown)
  - Materials
  - Dimensions
  - Date created
  - Tags
- Progress indicator during upload/processing
- Success: "Add to collection?" prompt

#### Edit Artwork `/profile/artworks/:id/edit`
- Edit metadata only (not image)
- "Replace Image" button (separate flow)
- Deactivate/reactivate toggle

#### Messages `/profile/messages`
- Inbox/Sent tabs
- Message list with preview
- Unread indicator
- Context badge (which artwork/gallery it's about)
- Compose button

#### Message Thread `/profile/messages/:id`
- Full message content
- Context link (to artwork/gallery referenced)
- Reply input
- Report button (sends to admin review)

---

### Admin Pages

#### Admin Dashboard `/admin`
- Stats overview: users, galleries, artworks, messages
- Quick links to common actions
- Activity feed (recent signups, uploads, flags)

#### User Management `/admin/users`
- Searchable user table
- Columns: username, email, status, created, artworks count
- Actions: View, Suspend, Activate, Adjust Limits
- Click through to user detail

#### User Detail `/admin/users/:id`
- Full user profile (including email)
- Account status controls
- Limit adjustments
- Activity history
- Direct message button

#### Moderation Queue `/admin/messages/pending`
- List of flagged messages
- Show: sender, recipient, context, tone score, flag reason
- Actions: Approve, Reject
- Preview message content
- Link to related artwork/user

---

## Components

### Navigation
- **Mobile**: Bottom tab bar (Home, Browse, Upload, Profile)
- **Desktop**: Top header with same options
- **Back button**: Always visible in nested views
- **Breadcrumbs**: Show path on desktop (Artist > Gallery > Collection > Artwork)

### Artwork Card
- Square thumbnail
- Title on hover/tap
- Artist name overlay
- Lazy-loaded images

### Gallery Card
- Cover image (first collection's hero or placeholder)
- Gallery name
- Collection count badge

### Upload Button (FAB)
- Floating action button on mobile
- Fixed position, bottom-right
- Only shown when authenticated

### Share Sheet
- Native share on mobile
- Copy link + social buttons on desktop
- Open Graph meta tags for rich previews

### Theme Picker
- Visual preview of each theme
- "System", "Public", "My Themes" tabs
- Copy theme button

### Toast Notifications
- Success (green): "Artwork uploaded!"
- Error (red): "Upload failed. Try again."
- Info (blue): "Saving..."
- Auto-dismiss after 3 seconds

---

## Responsive Breakpoints

| Name | Width | Layout |
|------|-------|--------|
| Mobile | < 640px | Single column, bottom nav |
| Tablet | 640-1024px | 2-column grids, bottom nav |
| Desktop | > 1024px | 3-4 column grids, top nav |

---

## Accessibility

- Minimum touch target: 44x44px
- Color contrast ratio: 4.5:1 minimum
- Alt text required for all artwork images
- Keyboard navigation support
- Screen reader friendly markup
- Focus indicators visible

---

## Loading States

- Skeleton loaders for grids
- Spinner for form submissions
- Progress bar for uploads
- Optimistic UI updates where possible

---

## Error States

- Empty states with helpful illustrations
- "Something went wrong" with retry button
- Form validation inline
- Network error with offline indicator

---

## Ads Placement

- Footer area only
- Below all content
- Clearly marked as advertisement
- Never between artwork items
- Respects user scroll position
