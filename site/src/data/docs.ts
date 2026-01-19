// Documentation content
// Each doc has an id (for routing), title, and HTML content

export interface DocSection {
  id: string;
  title: string;
  content: string;
  readTime?: string;
}

// =============================================================================
// GALLERY USER DOCUMENTATION (for vfa.gallery users)
// =============================================================================

export const gettingStartedDocs: DocSection[] = [
  {
    id: 'welcome',
    title: 'Welcome to VFA Gallery',
    readTime: '2 min',
    content: `
      <p>VFA.Gallery is a free online gallery for emerging visual artists. Create your portfolio, organize your work into galleries and collections, and share it with the world.</p>

      <h3>What You Get</h3>
      <ul>
        <li>A personal artist profile at <code>vfa.gallery/your-name</code></li>
        <li>Unlimited galleries and collections to organize your work</li>
        <li>Easy uploads from phone or computer</li>
        <li>Shareable links for every artwork</li>
        <li>Customizable themes to match your style</li>
      </ul>

      <h3>Who It's For</h3>
      <p>VFA Gallery is built for emerging artists—especially comics and manga creators who want a simple, beautiful place to showcase their work without the noise of social media.</p>

      <p><strong>No likes. No follower counts. No algorithm.</strong> Just your art, presented the way you want it.</p>
    `
  },
  {
    id: 'create-account',
    title: 'Creating Your Account',
    readTime: '2 min',
    content: `
      <h3>Sign Up</h3>
      <ol>
        <li>Go to <a href="https://vfa.gallery" target="_blank" rel="noopener">vfa.gallery</a></li>
        <li>Click <strong>Sign In</strong></li>
        <li>Choose Google or Apple sign-in</li>
        <li>Complete email verification</li>
      </ol>

      <h3>Set Up Your Profile</h3>
      <p>After signing in, you'll set up your artist profile:</p>
      <ul>
        <li><strong>Display Name</strong> — How you want to be known</li>
        <li><strong>Username</strong> — Your URL slug (e.g., <code>vfa.gallery/your-username</code>)</li>
        <li><strong>Avatar</strong> — A profile image or logo</li>
        <li><strong>Bio</strong> — A short description of yourself and your work</li>
      </ul>

      <h3>New Account Limits</h3>
      <p>New accounts have a 10-upload-per-day limit for the first week. This helps us prevent spam. After that, you can upload freely within your account limits.</p>
    `
  },
  {
    id: 'uploading-artwork',
    title: 'Uploading Artwork',
    readTime: '3 min',
    content: `
      <h3>Upload an Image</h3>
      <ol>
        <li>Go to your profile or any collection</li>
        <li>Click the <strong>+</strong> button or <strong>Upload</strong></li>
        <li>Choose an image from your phone or computer</li>
        <li>Add a title and description</li>
        <li>Click <strong>Upload</strong></li>
      </ol>

      <h3>Image Requirements</h3>
      <ul>
        <li><strong>Max size:</strong> 5MB per image</li>
        <li><strong>Formats:</strong> JPG, PNG, WebP</li>
        <li><strong>Recommended:</strong> JPG for photos, PNG for line art</li>
      </ul>

      <h3>What Happens After Upload</h3>
      <p>When you upload, we automatically generate:</p>
      <ul>
        <li>A display version (with your username watermark)</li>
        <li>A thumbnail for gallery grids</li>
        <li>An icon for navigation</li>
      </ul>

      <p><strong>Note:</strong> Artwork can't be overwritten—if you need to replace an image, upload a new version and remove the old one from the collection.</p>
    `
  },
  {
    id: 'organizing-work',
    title: 'Galleries & Collections',
    readTime: '3 min',
    content: `
      <h3>How Organization Works</h3>
      <p>Your work is organized in a hierarchy:</p>
      <ul>
        <li><strong>Artist Profile</strong> — Your main page</li>
        <li><strong>Galleries</strong> — Like rooms in a museum</li>
        <li><strong>Collections</strong> — Groups of related artwork within a gallery</li>
        <li><strong>Artworks</strong> — Individual pieces</li>
      </ul>

      <p>Example URL: <code>vfa.gallery/sam-corl/manga-portfolio/winter-2025/dragon-01</code></p>

      <h3>Creating a Gallery</h3>
      <ol>
        <li>Go to your profile</li>
        <li>Click <strong>New Gallery</strong></li>
        <li>Give it a name and optional description</li>
        <li>Choose a theme (or inherit from your profile)</li>
      </ol>

      <h3>Creating a Collection</h3>
      <ol>
        <li>Open a gallery</li>
        <li>Click <strong>New Collection</strong></li>
        <li>Name it and optionally add a hero image</li>
        <li>Start adding artwork</li>
      </ol>

      <h3>Default Spaces</h3>
      <p>Every account comes with a default gallery and collection for testing. You can rename or delete these once you're ready.</p>
    `
  },
  {
    id: 'sharing',
    title: 'Sharing Your Work',
    readTime: '2 min',
    content: `
      <h3>Shareable URLs</h3>
      <p>Every page has a clean, human-readable URL you can share:</p>
      <ul>
        <li>Your profile: <code>vfa.gallery/your-name</code></li>
        <li>A gallery: <code>vfa.gallery/your-name/gallery-name</code></li>
        <li>A collection: <code>vfa.gallery/your-name/gallery/collection</code></li>
        <li>An artwork: <code>vfa.gallery/your-name/gallery/collection/artwork</code></li>
      </ul>

      <h3>Social Sharing</h3>
      <p>Use the share button on any artwork to post directly to Instagram, Facebook, Twitter, and more. Each share includes a link back to your gallery.</p>

      <h3>Embedding</h3>
      <p>Coming soon: embed codes for displaying your work on other websites.</p>
    `
  }
];

export const accountDocs: DocSection[] = [
  {
    id: 'profile-settings',
    title: 'Profile Settings',
    content: `
      <h3>Editing Your Profile</h3>
      <p>Go to <strong>Profile</strong> → <strong>Settings</strong> to update:</p>
      <ul>
        <li>Display name and username</li>
        <li>Avatar and bio</li>
        <li>Contact info (visible only to you and admins)</li>
        <li>Social links</li>
      </ul>

      <h3>Privacy</h3>
      <p>Your email is never shown publicly. Only your username appears on your work.</p>
    `
  },
  {
    id: 'themes',
    title: 'Customizing Themes',
    content: `
      <h3>How Themes Work</h3>
      <p>Themes control colors and styling. You can set themes at different levels:</p>
      <ul>
        <li><strong>Profile theme</strong> — Default for all your content</li>
        <li><strong>Gallery theme</strong> — Overrides profile for that gallery</li>
        <li><strong>Collection theme</strong> — Overrides gallery for that collection</li>
        <li><strong>Artwork theme</strong> — Overrides collection for that piece</li>
      </ul>

      <h3>Available Themes</h3>
      <p>Choose from system themes (light, dark, gallery white, etc.) or create your own custom theme with your preferred colors.</p>

      <h3>Public Themes</h3>
      <p>You can make your custom themes public to share with other artists.</p>
    `
  },
  {
    id: 'messages',
    title: 'Messages & Feedback',
    content: `
      <h3>Receiving Feedback</h3>
      <p>Other users can send you direct messages about your work. Messages are private—there's no public comment section.</p>

      <h3>Message Guidelines</h3>
      <p>All messages are checked for tone. Negative or abusive messages won't be delivered. This is a supportive community for artists.</p>

      <h3>Contacting Admins</h3>
      <p>Use the <strong>Messages</strong> section to reach site administrators if you have questions or concerns.</p>
    `
  }
];

export const galleryTroubleshootingDoc: DocSection = {
  id: 'troubleshooting',
  title: 'Troubleshooting',
  content: `
    <h3>Can't Sign In</h3>
    <p>Make sure you're using the same Google or Apple account you signed up with. Try clearing your browser cache.</p>

    <h3>Upload Failed</h3>
    <ul>
      <li>Check that your image is under 5MB</li>
      <li>Try converting to JPG format</li>
      <li>Make sure you're connected to the internet</li>
    </ul>

    <h3>Image Looks Wrong</h3>
    <p>Images are automatically resized for display. If the quality looks off, try uploading a higher-resolution original.</p>

    <h3>Need Help?</h3>
    <p>Contact us through the <strong>Messages</strong> section or email <a href="mailto:samcorl@gmail.com">samcorl@gmail.com</a>.</p>
  `
};

// =============================================================================
// EDU DOCUMENTATION (for schools setting up their own gallery)
// =============================================================================

export const eduSetupDocs: DocSection[] = [
  {
    id: 'overview',
    title: 'What You\'re Building',
    readTime: '2 min',
    content: `
      <p>An online art gallery for your students, hosted entirely on Google Workspace tools your school already has.</p>

      <h3>What Students Get</h3>
      <ul>
        <li>A personal portfolio page showing all their work</li>
        <li>Easy image uploads from phone or computer</li>
        <li>A shareable link to show family and friends</li>
      </ul>

      <h3>What Teachers Get</h3>
      <ul>
        <li>A class gallery for each course you teach</li>
        <li>Simple student management (add/remove by email)</li>
        <li>Ability to feature outstanding work</li>
        <li>Everything stays within your school's Google domain</li>
      </ul>

      <h3>How It Works</h3>
      <table>
        <thead><tr><th>You'll Use</th><th>For</th></tr></thead>
        <tbody>
          <tr><td>Google Drive</td><td>Storing student artwork</td></tr>
          <tr><td>Google Sheets</td><td>Tracking students, classes, and artwork info</td></tr>
          <tr><td>Google Apps Script</td><td>Running the gallery website</td></tr>
        </tbody>
      </table>

      <p><strong>Cost:</strong> Free (uses tools included with Google Workspace for Education)</p>
      <p><strong>Who can see it:</strong> Only people with your school's Google accounts</p>
    `
  },
  {
    id: 'before-you-start',
    title: 'Before You Start',
    readTime: '2 min',
    content: `
      <h3>You Need</h3>
      <ul>
        <li>A Google account on your school's domain (e.g., yourname@school.edu)</li>
        <li>Permission to create and share Google Drive folders</li>
        <li>Permission to create Google Sheets</li>
        <li>About 1 hour of uninterrupted time</li>
      </ul>

      <h3>You Should Know How To</h3>
      <ul>
        <li>Create folders in Google Drive</li>
        <li>Share a Drive folder with others</li>
        <li>Open and edit Google Sheets</li>
      </ul>

      <h3>Get a Helper (Optional)</h3>
      <p>If you're not confident with Google tools, ask a tech-savvy parent volunteer, your school's IT person, or another teacher who's comfortable with spreadsheets.</p>
    `
  },
  {
    id: 'create-drive-folders',
    title: 'Create Your Drive Folders',
    readTime: '10 min',
    content: `
      <p>This folder will store all student artwork.</p>

      <h3>Step 1: Create the Main Folder</h3>
      <ol>
        <li>Go to <a href="https://drive.google.com" target="_blank" rel="noopener">Google Drive</a></li>
        <li>Click <strong>+ New</strong> → <strong>New folder</strong></li>
        <li>Name it: <code>Art Gallery</code></li>
        <li>Press <strong>Create</strong></li>
      </ol>

      <h3>Step 2: Create Subfolders</h3>
      <p>Inside your new Art Gallery folder, create two subfolders:</p>
      <ul>
        <li><code>classes</code></li>
        <li><code>featured</code></li>
      </ul>

      <h3>Step 3: Share with Your School</h3>
      <ol>
        <li>Right-click the Art Gallery folder</li>
        <li>Click <strong>Share</strong> → <strong>Share</strong></li>
        <li>Under "General access," select <strong>Anyone at [Your School] with the link</strong></li>
        <li>Make sure it says <strong>Viewer</strong> (not Editor)</li>
        <li>Click <strong>Done</strong></li>
      </ol>

      <h3>Step 4: Save the Folder ID</h3>
      <p>Look at the URL in your browser when inside the folder. Copy the long string after <code>/folders/</code> - that's your Folder ID. Save it for later.</p>
    `
  },
  {
    id: 'setup-database',
    title: 'Set Up the Database Spreadsheet',
    readTime: '10 min',
    content: `
      <p>This Google Sheet stores all your gallery data.</p>

      <h3>Step 1: Copy the Template</h3>
      <ol>
        <li>Open the <a href="#" class="template-link" data-template="sheets">Art Gallery Database Template</a></li>
        <li>Click <strong>File</strong> → <strong>Make a copy</strong></li>
        <li>Name it: <code>Art Gallery Database</code></li>
        <li>Click <strong>Make a copy</strong></li>
      </ol>

      <h3>Step 2: Review the Sheets</h3>
      <p>Your spreadsheet has these tabs:</p>
      <table>
        <thead><tr><th>Sheet</th><th>What It Stores</th></tr></thead>
        <tbody>
          <tr><td>Users</td><td>Student and teacher accounts</td></tr>
          <tr><td>Classes</td><td>Your class galleries</td></tr>
          <tr><td>ClassMembers</td><td>Which students are in which classes</td></tr>
          <tr><td>Collections</td><td>Student portfolios</td></tr>
          <tr><td>Artworks</td><td>Info about each uploaded image</td></tr>
          <tr><td>Themes</td><td>Display settings</td></tr>
          <tr><td>Config</td><td>Settings for your gallery</td></tr>
        </tbody>
      </table>

      <h3>Step 3: Update Config Settings</h3>
      <p>Click the <strong>Config</strong> tab and update:</p>
      <ul>
        <li><code>DRIVE_FOLDER_ID</code> - Your Folder ID from Step 3</li>
        <li><code>SCHOOL_DOMAIN</code> - Your school's domain (e.g., school.edu)</li>
        <li><code>GALLERY_NAME</code> - What you want to call it</li>
      </ul>

      <h3>Step 4: Save the Spreadsheet ID</h3>
      <p>Copy the long string between <code>/d/</code> and <code>/edit</code> in the URL. Save it with your Folder ID.</p>
    `
  },
  {
    id: 'deploy-web-app',
    title: 'Deploy the Web App',
    readTime: '15 min',
    content: `
      <p>This creates the actual gallery website.</p>

      <h3>Step 1: Copy the Apps Script Project</h3>
      <ol>
        <li>Open the <a href="#" class="template-link" data-template="script">Art Gallery Web App Template</a></li>
        <li>Click <strong>Overview</strong> → <strong>Make a copy</strong></li>
        <li>Name it: <code>Art Gallery Web App</code></li>
      </ol>

      <h3>Step 2: Connect to Your Spreadsheet</h3>
      <ol>
        <li>Click <strong>Project Settings</strong> (gear icon)</li>
        <li>Scroll to <strong>Script Properties</strong></li>
        <li>Add these properties:
          <ul>
            <li><code>SPREADSHEET_ID</code> - Your Spreadsheet ID</li>
            <li><code>DRIVE_FOLDER_ID</code> - Your Folder ID</li>
          </ul>
        </li>
        <li>Click <strong>Save script properties</strong></li>
      </ol>

      <h3>Step 3: Deploy as Web App</h3>
      <ol>
        <li>Click <strong>Deploy</strong> → <strong>New deployment</strong></li>
        <li>Select type: <strong>Web app</strong></li>
        <li>Execute as: <strong>User accessing the web app</strong></li>
        <li>Who has access: <strong>Anyone within [Your School Domain]</strong></li>
        <li>Click <strong>Deploy</strong></li>
      </ol>

      <h3>Step 4: Authorize the App</h3>
      <p>Click <strong>Authorize access</strong>, choose your school account, and allow permissions. You may see "Google hasn't verified this app" - click Advanced → Go to Art Gallery Web App.</p>

      <h3>Step 5: Get Your Gallery URL</h3>
      <p>Copy the <strong>Web app URL</strong> shown. This is your gallery! Save and bookmark it.</p>
    `
  },
  {
    id: 'first-class-setup',
    title: 'Create Your First Class',
    readTime: '10 min',
    content: `
      <h3>Step 1: Open the Admin Dashboard</h3>
      <ol>
        <li>Go to your gallery URL</li>
        <li>Sign in with your school Google account</li>
        <li>Click <strong>Admin</strong> to open the dashboard</li>
      </ol>

      <h3>Step 2: Create a Class Gallery</h3>
      <ol>
        <li>Click <strong>New Class</strong></li>
        <li>Enter class name (e.g., "Art 101 Fall 2025")</li>
        <li>Add description (optional)</li>
        <li>Click <strong>Create</strong></li>
      </ol>

      <h3>Step 3: Add Students</h3>
      <p><strong>One at a time:</strong> Click Add Student → Enter email → Add</p>
      <p><strong>Bulk import:</strong> Click Import Students → Paste emails (one per line) → Import</p>

      <h3>Step 4: Test It!</h3>
      <ol>
        <li>Open your gallery URL in a private window</li>
        <li>Sign in as a student would</li>
        <li>Verify they can see the class and upload a test image</li>
      </ol>

      <p><strong>You're done with setup!</strong> Share the gallery URL with your students.</p>
    `
  }
];

export const eduOperationsDocs: DocSection[] = [
  {
    id: 'teacher-guide',
    title: 'Teacher Guide',
    content: `
      <h3>Adding a New Class</h3>
      <p>Go to <strong>Admin</strong> → <strong>New Class</strong> → Enter class name → Add teachers and students.</p>

      <h3>Managing Students</h3>
      <ul>
        <li><strong>Add:</strong> Admin → Select class → Add Student → Enter email</li>
        <li><strong>Remove:</strong> Admin → Select class → Find student → Remove</li>
      </ul>
      <p>Removing a student hides their work but doesn't delete it.</p>

      <h3>Featuring Student Work</h3>
      <p>Find the artwork → Click the <strong>Feature</strong> button (star icon). Featured work appears on the gallery homepage.</p>

      <h3>Moderating Content</h3>
      <p>Click the artwork → Click <strong>Hide</strong> (eye icon). Contact the student separately.</p>

      <h3>Quick Reference</h3>
      <table>
        <thead><tr><th>Task</th><th>Where</th></tr></thead>
        <tbody>
          <tr><td>Add class</td><td>Admin → New Class</td></tr>
          <tr><td>Add student</td><td>Admin → Class → Add Student</td></tr>
          <tr><td>Feature work</td><td>Artwork → Star icon</td></tr>
          <tr><td>Hide content</td><td>Artwork → Eye icon</td></tr>
          <tr><td>Change theme</td><td>Admin → Themes</td></tr>
        </tbody>
      </table>
    `
  },
  {
    id: 'student-guide',
    title: 'Student Guide',
    content: `
      <h3>Getting Started</h3>
      <ol>
        <li>Go to the gallery URL your teacher gave you</li>
        <li>Click <strong>Sign In</strong></li>
        <li>Use your school Google account</li>
      </ol>

      <h3>Uploading Artwork</h3>
      <ol>
        <li>Click <strong>Upload</strong> (or the + button)</li>
        <li>Choose your image (from phone or computer)</li>
        <li>Add a title and description (optional)</li>
        <li>Click <strong>Upload</strong></li>
      </ol>
      <p><strong>Tip:</strong> JPG or PNG work best. Max size: 5MB.</p>

      <h3>Your Profile</h3>
      <p>Click your name to see your profile page with all your artwork across all classes. Share this link with family and friends!</p>

      <h3>Editing Your Work</h3>
      <p>Click on your artwork → Click <strong>Edit</strong> (pencil icon) → Make changes → Save.</p>
      <p>To delete: Click artwork → <strong>Delete</strong> (trash icon). Deleted artwork cannot be recovered.</p>
    `
  },
  {
    id: 'semester-archive',
    title: 'End of Semester',
    content: `
      <h3>Why Archive?</h3>
      <ul>
        <li>Keeps your class list clean</li>
        <li>Preserves student work permanently</li>
        <li>Archived classes become read-only</li>
      </ul>

      <h3>How to Archive</h3>
      <ol>
        <li>Go to <strong>Admin</strong> → Select the class</li>
        <li>Click <strong>Archive Class</strong></li>
        <li>Confirm</li>
      </ol>
      <p>Students can still view archived work on their profile page.</p>

      <h3>Starting a New Semester</h3>
      <ol>
        <li>Create a new class (e.g., "Art 101 Spring 2026")</li>
        <li>Add returning students - they'll have a fresh collection</li>
        <li>Their old work remains in the archived class</li>
      </ol>
    `
  }
];

export const eduTroubleshootingDoc: DocSection = {
  id: 'troubleshooting',
  title: 'Troubleshooting',
  content: `
    <h3>Sign-In Problems</h3>
    <p><strong>"I can't sign in"</strong> - Make sure you're using your school Google account, not personal Gmail.</p>
    <p><strong>"Access denied"</strong> - Verify you're added to the class. Ask IT if Apps Script is enabled.</p>

    <h3>Upload Problems</h3>
    <p><strong>"Upload failed"</strong> - Check image is under 5MB. Try JPG format. Try a smaller image.</p>

    <h3>Can't See Content</h3>
    <p><strong>"I don't see my class"</strong> - Ask your teacher to add you with your exact email.</p>
    <p><strong>"Everything disappeared"</strong> - Sign out and back in. Clear browser cache.</p>

    <h3>Admin/Setup Problems</h3>
    <p><strong>"I don't see the Admin link"</strong> - Only teachers/admins see this. Check you're signed in with the setup account.</p>
    <p><strong>"Web app shows an error"</strong> - Check Script Properties match your IDs exactly. Re-deploy if needed.</p>
    <p><strong>"Changes aren't showing up"</strong> - After editing Apps Script, create a new deployment version.</p>
  `
};
