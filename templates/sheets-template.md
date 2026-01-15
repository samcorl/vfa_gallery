# Google Sheets Database Template

This document describes the structure of the Google Sheets database template. Teachers will make a copy of this template spreadsheet.

---

## How to Create the Template

1. Create a new Google Sheet
2. Rename it: `VFA Gallery Database Template`
3. Create the sheets (tabs) listed below with the exact column headers
4. Share the template with "Anyone with the link can view"
5. Copy the sharing URL for the documentation

---

## Sheet: Config

Settings for the gallery installation.

| Key | Value | Description |
|-----|-------|-------------|
| DRIVE_FOLDER_ID | | The ID of the Art Gallery Drive folder |
| SCHOOL_DOMAIN | school.edu | Your school's Google Workspace domain |
| GALLERY_NAME | School Art Gallery | Display name for the gallery |
| ADMIN_EMAIL | | Email of the primary admin (auto-set on first access) |
| CREATED_AT | | Timestamp when gallery was created |
| VERSION | 1.0 | Template version |

---

## Sheet: Users

All users (students and teachers) who access the gallery.

| Column | Type | Description |
|--------|------|-------------|
| id | string | Unique identifier (auto-generated UUID) |
| email | string | School email address |
| name | string | Display name (from Google profile) |
| avatar_url | string | Profile picture URL (from Google) |
| role | string | `student`, `teacher`, or `admin` |
| status | string | `active` or `inactive` |
| created_at | datetime | When user first accessed the gallery |
| last_login | datetime | Most recent login timestamp |

---

## Sheet: Classes

Class galleries (one per class/semester).

| Column | Type | Description |
|--------|------|-------------|
| id | string | Unique identifier (auto-generated UUID) |
| name | string | Class name (e.g., "Art 101 Fall 2025") |
| description | string | Optional description |
| slug | string | URL-safe version of name |
| drive_folder_id | string | ID of this class's folder in Drive |
| status | string | `active` or `archived` |
| theme_id | string | Reference to Themes sheet (optional) |
| created_by | string | User ID of creator |
| created_at | datetime | When class was created |
| archived_at | datetime | When class was archived (if applicable) |

---

## Sheet: ClassMembers

Links users to classes with their role.

| Column | Type | Description |
|--------|------|-------------|
| id | string | Unique identifier |
| class_id | string | Reference to Classes sheet |
| user_id | string | Reference to Users sheet |
| role | string | `teacher` or `student` |
| added_by | string | User ID who added this member |
| added_at | datetime | When member was added |

---

## Sheet: Collections

Student portfolios within a class (one per student per class).

| Column | Type | Description |
|--------|------|-------------|
| id | string | Unique identifier |
| class_id | string | Reference to Classes sheet |
| user_id | string | Reference to Users sheet (the student) |
| name | string | Collection name (defaults to student name) |
| description | string | Optional description |
| drive_folder_id | string | ID of student's folder within class folder |
| theme_id | string | Reference to Themes sheet (optional) |
| created_at | datetime | When collection was created |

---

## Sheet: Artworks

Individual artwork uploads.

| Column | Type | Description |
|--------|------|-------------|
| id | string | Unique identifier |
| collection_id | string | Reference to Collections sheet |
| user_id | string | Reference to Users sheet (uploader) |
| title | string | Artwork title |
| description | string | Optional description |
| drive_file_id | string | ID of the image file in Drive |
| drive_thumb_id | string | ID of the thumbnail in Drive |
| file_name | string | Original filename |
| file_size | number | Size in bytes |
| mime_type | string | e.g., "image/jpeg" |
| width | number | Image width in pixels |
| height | number | Image height in pixels |
| status | string | `visible`, `hidden`, or `deleted` |
| featured | boolean | Whether this is featured on homepage |
| created_at | datetime | Upload timestamp |
| updated_at | datetime | Last edit timestamp |

---

## Sheet: Themes

Display configuration options.

| Column | Type | Description |
|--------|------|-------------|
| id | string | Unique identifier |
| name | string | Theme name |
| type | string | `system` (read-only) or `custom` |
| background_color | string | Hex color (e.g., "#ffffff") |
| text_color | string | Hex color |
| accent_color | string | Hex color |
| card_style | string | `light`, `dark`, or `transparent` |
| created_by | string | User ID (null for system themes) |
| created_at | datetime | When theme was created |

### Default System Themes

Pre-populate with these rows:

| name | background_color | text_color | accent_color | card_style |
|------|------------------|------------|--------------|------------|
| Light | #ffffff | #1a1a1a | #2563eb | light |
| Dark | #1a1a1a | #ffffff | #60a5fa | dark |
| Gallery White | #f5f5f5 | #262626 | #dc2626 | light |
| Museum | #1c1917 | #fafaf9 | #eab308 | dark |

---

## Notes for Template Creator

1. **Formatting**: Apply header row formatting (bold, background color) for readability
2. **Data validation**: Add dropdown validation for status/role columns where appropriate
3. **Protection**: Consider protecting the Config sheet to prevent accidental edits
4. **Freeze rows**: Freeze the header row on each sheet
5. **Column widths**: Adjust column widths for readability

---

## Template Distribution

Once created:
1. File → Share → General access → "Anyone with the link" → Viewer
2. Copy the link
3. Update the documentation with the template link
