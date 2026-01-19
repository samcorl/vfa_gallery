# Technical Specification
## You Should Be In . Pictures

### Overview
An online gallery platform for emerging visual fine artists, optimized for comics and manga creators. Mobile-first, minimalist design that lets the art speak for itself.

---

## Technology Stack

### Frontend
- **Framework:** React (latest stable) with TypeScript
- **Routing:** React Router for URL-based state management
- **State Management:** React Context + hooks for atomic live-edit operations
- **Styling:** CSS Modules or Tailwind CSS (TBD)
- **Build Tool:** Vite

### Backend / Infrastructure
- **Hosting:** CloudFlare Pages (static/serverless)
- **Database:** CloudFlare D1 (SQLite-compatible)
- **Image Storage:** CloudFlare R2 (S3-compatible)
- **CDN:** CloudFlare (automatic with Pages)
- **CI/CD:** GitHub Actions

### Authentication
- **SSO Providers:** Google and/or Apple Sign-In
- **Session Management:** JWT tokens stored in httpOnly cookies
- **No custom auth** - delegated entirely to SSO providers

### Image Processing
- **Upload Limit:** 5MB per image
- **Generated Assets:**
  - Display version (watermarked with artist username)
  - Thumbnail (for gallery grids)
  - Icon (for navigation/previews)
- **Processing:** CloudFlare Workers or client-side before upload

---

## URL Structure

All URLs use slugs for human-readable, shareable links.

```
/                                           # Homepage
/browse                                     # Browse artwork
/search                                     # Search artwork
/groups/{group-slug}                        # Group/org public page

/{artist-slug}                              # Artist profile
/{artist-slug}/{gallery-slug}               # Gallery
/{artist-slug}/{gallery-slug}/{collection-slug}           # Collection
/{artist-slug}/{gallery-slug}/{collection-slug}/{artwork-slug}  # Artwork

/profile                                    # Current user profile (auth required)
/profile/galleries                          # User's galleries
/profile/messages                           # User's messages
/admin                                      # Admin dashboard (admin role required)
```

### Slug Rules
- Lowercase alphanumeric + hyphens only
- No consecutive hyphens
- 3-50 characters
- Unique within scope (artist slugs globally unique, gallery slugs unique per artist, etc.)

---

## Rate Limits & Quotas

### New Account Limits
- 10 uploads/day for first 7 days
- Auto-flag for suspicious activity (rapid uploads, duplicate images)

### Per-User Limits (Adjustable by Admin)
| Resource    | Default Limit |
|-------------|---------------|
| Galleries   | 500           |
| Collections | 1,000         |
| Artworks    | 5,000         |

---

## Security Considerations

### Content Moderation
- Image moderation approach TBD
- Message scoring for tone/language (non-LLM primary, LLM fallback)
- Suspect content goes to "pending review" queue

### Privacy
- Only usernames visible publicly
- Email addresses visible only to admins
- No public "likes" or rating systems

### Abuse Prevention
- CAPTCHA on registration
- Email verification required for activation
- Zero tolerance for illegal activity

---

## Monetization

- Ad-supported, free for all artists
- Ads placed near footer, below content
- Minimal intrusion - art comes first
- No premium tiers initially planned

---

## Admin Tools

### Web UI (Admin Dashboard)
- User management (activate/deactivate)
- Adjust per-user limits
- Message moderation queue
- Direct messaging with users

### Developer Scripts (Ruby preferred, Node/TS fallback)
- Bulk user management
- Database maintenance
- Analytics/reporting
- Migration utilities
