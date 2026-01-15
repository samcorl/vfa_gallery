# VFA.gallery
## Google Workspace for Education Edition

A self-hosted version for schools using only tools available in Google Workspace for Education.

### Goal
Schools own and operate their own instance with no external costs. Teacher-managed, IT-optional.

---

## Technology Stack (All Free with Workspace)

| Component | Google Tool | Notes |
|-----------|-------------|-------|
| App hosting | Google Apps Script (web app) | Deploys as URL within school domain |
| Database | Google Sheets | One sheet per data type (users, galleries, artworks, etc.) |
| Image storage | Google Drive | Shared folder structure mirrors gallery hierarchy |
| Authentication | Built-in Workspace SSO | Restrict to @schooldomain.edu accounts |
| File processing | Apps Script | Thumbnail generation via Drive API |
| Messaging | Google Chat / Email | No in-app messaging - use existing tools |

---

## Architecture

### Google Drive Folder Structure
```
/Art Gallery Root (shared with school domain)
  /classes
    /art-101-fall-2025
      /jane-doe
        artwork-001.jpg
        artwork-001-thumb.jpg
      /john-smith
    /art-201-fall-2025
      /jane-doe
      /bob-jones
  /featured
```

### Google Sheets "Database"
- `Users` - student/teacher accounts, roles
- `Classes` - class galleries, teacher assignments
- `ClassMembers` - which students are in which classes
- `Collections` - student portfolios (one per student per class)
- `Artworks` - image metadata, Drive file IDs, descriptions
- `Themes` - display configuration

---

## Key Differences from Public Version

| Feature | Public Version | School Edition |
|---------|----------------|----------------|
| Hosting | Cloudflare Pages | Apps Script Web App |
| Database | D1 (SQLite) | Google Sheets |
| Image storage | R2 | Google Drive |
| Auth | Google/Apple SSO | Workspace SSO only |
| Ads | Footer ads | None |
| URL format | youshouldbein.pictures/artist/... | script.google.com/.../exec?path=... |
| Custom domain | Yes | Possible but requires IT |
| Messaging | In-app | Google Chat / Email links |
| Visibility | Public internet | School domain only |

---

## Roles

### IT Admin (optional)
- Can set up custom subdomain (e.g., gallery.school.edu)
- Can adjust Apps Script permissions if needed
- Not required for basic operation

### Teacher
- Creates class galleries (one per class/semester)
- Adds students to their class galleries
- Can be assigned to multiple classes
- Multiple teachers can share a class gallery
- Moderates content
- Features selected student work
- Manages themes
- Manually archives old class galleries

### Student
- Signs in with school Google account
- Has one collection per class they're enrolled in
- Uploads artwork to their class collections
- Edits descriptions and metadata
- Views ALL student work across ALL classes at the school
- Student profile page shows all their collections across classes

---

## Visibility Rules

- All students can see all galleries and collections school-wide
- Teachers see everything
- No public access by default (school domain only)
- Featured work can optionally be shared publicly (see Public Sharing Option)

---

## Simplified Feature Set

### Included
- Class galleries (one per class/semester)
- Student collections within each class
- Student profile page (shows all their collections across classes)
- Image upload with auto-thumbnails
- Basic themes (light/dark/custom colors)
- Featured artwork showcase
- Social sharing links
- Multiple teachers per class

### Not Included (use existing tools)
- Messaging (use Google Chat / Email)
- Groups/Organizations (use class galleries)
- Natural language search (simple text search only)
- Rate limiting (trusted users, smaller scale)
- Auto-archive (manual for now)

---

## Setup Guide (for Teachers)

### 1. Create the Drive folder
- Create "Art Gallery" folder in your Drive
- Share with "Anyone at [school] with link can view"
- Create subfolders: `classes`, `featured`

### 2. Copy the Sheets database
- Make a copy of the template spreadsheet (link TBD)
- Share with other teachers who need admin access

### 3. Deploy the Apps Script
- Open the script project (link TBD)
- Deploy > New deployment > Web app
- Execute as: "User accessing the web app"
- Access: "Anyone within [school domain]"
- Copy the deployment URL

### 4. Share with students
- Give students the web app URL
- They sign in with school accounts automatically

### 5. Create a class gallery
- Go to admin dashboard
- Create new class (e.g., "Art 101 Fall 2025")
- Add yourself and any co-teachers
- Add students by email or import from roster

---

## Semester Rollover

When a semester ends:
1. Teacher manually archives the class gallery (marks inactive)
2. Archived galleries remain viewable but read-only
3. Create new class gallery for next semester
4. Student work persists - visible on their profile page

---

## Limitations & Workarounds

### Google Sheets as database
- **Limit:** ~50,000 rows practical max per sheet
- **Workaround:** Archive old semesters to separate sheets if needed

### Drive API quotas
- **Limit:** 1 billion queries/day (not a concern at school scale)
- **Limit:** 750 GB upload/day per user
- **Workaround:** None needed

### Apps Script execution time
- **Limit:** 6 minutes per execution
- **Workaround:** Batch operations, pagination

### No custom domain without IT
- **Limit:** URL is ugly script.google.com/...
- **Workaround:** Use a link shortener or school's existing redirect tools

### Image processing
- **Limit:** Apps Script has limited image manipulation
- **Workaround:** Accept pre-sized images or use Drive's built-in thumbnail generation

---

## Public Sharing Option

If school wants to showcase work publicly:
1. Teacher moves featured works to `featured` folder
2. Shares `featured` folder with "Anyone with the link"
3. Share the public gallery URL externally

Non-featured student work remains school-only.

---

## Student Data (TBD)

What happens when students graduate or leave:
- TBD: Export/download option for students
- TBD: Data retention policy

---

## Migration Path

If a school outgrows this or wants more features:
1. Export Sheets data as CSV
2. Download Drive images
3. Import to public youshouldbein.pictures instance
4. Students keep their work

---

## Development Notes

### Apps Script web app structure
```
/Code.gs          - main entry, routing
/Database.gs      - Sheets read/write helpers
/Drive.gs         - file upload, thumbnails
/Auth.gs          - session, role checks
/Html/
  index.html      - SPA shell
  class.html      - class gallery view
  student.html    - student profile (all collections)
  upload.html     - artwork upload form
  admin.html      - teacher dashboard
```

---

## Support Model

- Initial setup assistance
- Documentation and video guides
- Ongoing support for questions/issues
- No cost to school
