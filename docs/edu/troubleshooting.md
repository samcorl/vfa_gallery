# Troubleshooting

Common issues and how to fix them.

---

## Sign-In Problems

### "I can't sign in"
- **Check:** Are you using your school Google account?
- **Check:** Is the gallery URL correct?
- **Try:** Sign out of all Google accounts, then sign in with just your school account

### "Access denied" or "You don't have permission"
- **Check:** You're using an @school.edu account, not personal Gmail
- **Ask:** Your teacher to verify you're added to the class
- **Ask:** IT if Apps Script is enabled for your school

---

## Upload Problems

### "Upload failed"
- **Check:** Is the image under 5MB?
- **Try:** A different image format (JPG usually works best)
- **Try:** A smaller image
- **Check:** You're connected to the internet

### "Image looks wrong after upload"
- Large images are automatically resized
- Very wide or tall images may be cropped
- Upload square or 4:3 ratio images for best results

---

## Can't See Content

### "I don't see my class"
- **Ask:** Your teacher to add you (they need your exact email)
- **Check:** You're signed into the correct account

### "I don't see a student's work"
- **Check:** Did they actually upload anything?
- **Check:** Is the student in the correct class?
- **Try:** Refresh the page

### "Everything disappeared"
- **Try:** Sign out and back in
- **Try:** Clear your browser cache
- **Check:** The spreadsheet and Drive folder still exist

---

## Admin/Setup Problems

### "I don't see the Admin link"
- Only teachers/admins see this link
- **Check:** You're signed in with the account that set up the gallery
- **Fix:** Add yourself as admin in the Users sheet manually

### "Web app shows an error"
- **Check:** Script Properties match your Spreadsheet ID and Folder ID exactly
- **Check:** No extra spaces in the IDs
- **Try:** Re-deploy the web app (Deploy → Manage deployments → New version)

### "Changes aren't showing up"
- After editing the Apps Script, you must create a new deployment
- **Fix:** Deploy → Manage deployments → Edit → New version → Deploy

---

## Drive/Storage Problems

### "Drive folder missing"
- Someone may have deleted or moved it
- **Fix:** Create a new folder and update the Script Properties with the new ID

### "Out of storage"
- Schools typically have ample storage, but check with IT
- Consider archiving and backing up very old classes

---

## Still Stuck?

1. Check that all your IDs (Folder, Spreadsheet) are correct
2. Try the operation in a private/incognito window
3. Ask a colleague to try on their account
4. Contact: [Your support contact here]

---

## Reporting Bugs

If you find a bug in the gallery app itself:

1. Note exactly what you did
2. Screenshot any error messages
3. Note which browser you're using
4. Contact: [Developer contact here]
