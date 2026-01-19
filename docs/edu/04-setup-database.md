# Set Up the Database Spreadsheet

This Google Sheet stores all your gallery data. Takes about 10 minutes.

---

## Step 1: Copy the Template

1. Open the template spreadsheet:
   **[Art Gallery Database Template](LINK_TBD)**
2. Click **File** → **Make a copy**
3. Name it: `Art Gallery Database`
4. Choose where to save it (your Drive or the Art Gallery folder)
5. Click **Make a copy**

---

## Step 2: Review the Sheets

Your new spreadsheet has these tabs (sheets) at the bottom:

| Sheet | What It Stores |
|-------|----------------|
| Users | Student and teacher accounts |
| Classes | Your class galleries |
| ClassMembers | Which students are in which classes |
| Collections | Student portfolios |
| Artworks | Info about each uploaded image |
| Themes | Display settings (colors, layouts) |
| Config | Settings for your gallery |

> **Don't edit these directly** unless troubleshooting. The web app manages this data.

---

## Step 3: Update Config Settings

1. Click the **Config** tab at the bottom
2. Find these rows and update them:

| Setting | What to Enter |
|---------|---------------|
| `DRIVE_FOLDER_ID` | The Folder ID you saved in Step 3 |
| `SCHOOL_DOMAIN` | Your school's domain (e.g., `school.edu`) |
| `GALLERY_NAME` | What you want to call it (e.g., `Lincoln High Art Gallery`) |

---

## Step 4: Save the Spreadsheet ID

You'll need this for the web app setup.

1. Look at the URL of your spreadsheet:
   ```
   https://docs.google.com/spreadsheets/d/1ABC123xyz.../edit
   ```
2. Copy the long string between `/d/` and `/edit` (that's your Spreadsheet ID)
3. Save it with your Folder ID from earlier

---

## Step 5: Share with Co-Teachers (Optional)

If other teachers need admin access:

1. Click **Share** (top right)
2. Add their school email addresses
3. Give them **Editor** access
4. Click **Send**

> Only share with teachers who need to manage the gallery. Students never need access to this spreadsheet.

---

## Checkpoint

You should now have:

- [x] Your own copy of the database spreadsheet
- [x] Config settings updated with your Folder ID and school domain
- [x] The Spreadsheet ID copied and saved

---

## Something Wrong?

**"I can't make a copy"**
Make sure you're signed into your school Google account, not a personal one.

**"I don't see all the tabs"**
Scroll the tab bar at the bottom, or click the small arrows on the left/right of the tab bar.

**"What if I mess something up?"**
You can always delete this copy and make a fresh one from the template.

---

**Next:** [Deploy the Web App](05-deploy-web-app.md)
