# Deploy the Web App

This creates the actual gallery website. Takes about 15 minutes.

---

## Step 1: Copy the Apps Script Project

1. Open the template script project:
   **[Art Gallery Web App Template](LINK_TBD)**
2. Click **Overview** (left sidebar) → **Make a copy** (icon in top right)
3. Name it: `Art Gallery Web App`
4. Click **Make a copy**

---

## Step 2: Connect to Your Spreadsheet

1. In your new script project, click **Project Settings** (gear icon, left sidebar)
2. Scroll down to **Script Properties**
3. Click **Add script property**
4. Add these properties:

| Property | Value |
|----------|-------|
| `SPREADSHEET_ID` | Your Spreadsheet ID from Step 4 |
| `DRIVE_FOLDER_ID` | Your Folder ID from Step 3 |

5. Click **Save script properties**

---

## Step 3: Deploy as Web App

1. Click **Deploy** (top right) → **New deployment**
2. Click the gear icon next to "Select type" → choose **Web app**
3. Fill in:
   - **Description:** `Initial deployment` (or today's date)
   - **Execute as:** `User accessing the web app`
   - **Who has access:** `Anyone within [Your School Domain]`
4. Click **Deploy**

---

## Step 4: Authorize the App

A popup will ask for permissions. This is normal.

1. Click **Authorize access**
2. Choose your school Google account
3. You may see "Google hasn't verified this app" - click **Advanced** → **Go to Art Gallery Web App (unsafe)**
4. Review permissions and click **Allow**

> **Why "unsafe"?** Google shows this for any custom script. It's your own code running on your own account - it's safe.

---

## Step 5: Get Your Gallery URL

After deployment completes:

1. Copy the **Web app URL** shown
2. This is your gallery! Save this URL.
3. Test it by opening in a new browser tab

The URL looks like:
```
https://script.google.com/a/school.edu/macros/s/ABC123.../exec
```

> **Tip:** Bookmark this URL or create a short link using your school's tools.

---

## Checkpoint

You should now have:

- [x] Your own copy of the Apps Script project
- [x] Script properties configured
- [x] Web app deployed
- [x] Your gallery URL saved and tested

---

## Something Wrong?

**"I don't see 'Make a copy'"**
You might be in the wrong view. Look for the Overview icon (circle with "i") in the left sidebar.

**"Authorization failed"**
Make sure you're using your school Google account. Some schools restrict Apps Script - ask IT if you're blocked.

**"Web app shows an error"**
Double-check your Script Properties match your Spreadsheet ID and Folder ID exactly. No extra spaces!

**"I need to update the app later"**
Click Deploy → Manage deployments → Edit (pencil icon) → Version: New version → Deploy

---

**Next:** [Create Your First Class](06-first-class-setup.md)
