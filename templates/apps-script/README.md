# VFA Gallery - Apps Script Template

This folder contains the Google Apps Script web app template for the VFA Gallery.

## Files

| File | Purpose |
|------|---------|
| `Code.gs` | Main entry point, routing, configuration |
| `Auth.gs` | Authentication, user management, permissions |
| `Database.gs` | Google Sheets CRUD operations |
| `Drive.gs` | Google Drive file operations, artwork upload |
| `Themes.gs` | Theme management |
| `index.html` | Main HTML template (SPA shell) |
| `styles.html` | CSS styles (included in index.html) |
| `scripts.html` | Client-side JavaScript (included in index.html) |

## Setup Instructions

### Option 1: Create from scratch in Apps Script editor

1. Go to [script.google.com](https://script.google.com)
2. Click **New project**
3. Rename to "VFA Gallery Web App"
4. Create each `.gs` file:
   - Click **+** next to Files → **Script**
   - Name it (without .gs extension)
   - Copy contents from corresponding file here
5. Create each `.html` file:
   - Click **+** next to Files → **HTML**
   - Name it (without .html extension)
   - Copy contents from corresponding file here

### Option 2: Use clasp (command line)

If you have [clasp](https://github.com/google/clasp) installed:

```bash
# Login to Google
clasp login

# Create new project
clasp create --title "VFA Gallery Web App" --type webapp

# Push files
clasp push

# Open in browser
clasp open
```

## Configuration

After creating the project:

1. Go to **Project Settings** (gear icon)
2. Under **Script Properties**, add:
   - `SPREADSHEET_ID` - ID of your database spreadsheet
   - `DRIVE_FOLDER_ID` - ID of your Art Gallery Drive folder

## Deployment

1. Click **Deploy** → **New deployment**
2. Select type: **Web app**
3. Configuration:
   - Description: "Initial deployment"
   - Execute as: **User accessing the web app**
   - Who has access: **Anyone within [Your School Domain]**
4. Click **Deploy**
5. Authorize when prompted
6. Copy the web app URL

## Updating

After making changes:

1. Click **Deploy** → **Manage deployments**
2. Click the pencil icon to edit
3. Version: **New version**
4. Click **Deploy**

## Architecture Notes

- **Single Page App (SPA)**: The index.html serves as a shell, with JavaScript handling routing
- **Server-side rendering**: Initial data passed via template variables
- **API pattern**: POST requests to doPost() for all mutations
- **Authentication**: Uses Apps Script's built-in Session.getActiveUser()
- **Storage**: Google Sheets as database, Google Drive for files
