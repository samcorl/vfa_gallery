/**
 * VFA Gallery - Authentication & Authorization
 */

/**
 * Get current user info and ensure they exist in the database
 */
function getCurrentUser() {
  const email = Session.getActiveUser().getEmail();
  if (!email) return null;

  // Check school domain
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const configSheet = ss.getSheetByName('Config');
  const configData = configSheet.getDataRange().getValues();

  let schoolDomain = '';
  for (let i = 0; i < configData.length; i++) {
    if (configData[i][0] === 'SCHOOL_DOMAIN') {
      schoolDomain = configData[i][1];
      break;
    }
  }

  // Verify user is from school domain
  if (schoolDomain && !email.endsWith('@' + schoolDomain)) {
    return null;
  }

  // Get or create user record
  return getOrCreateUser(email);
}

/**
 * Get existing user or create new one
 */
function getOrCreateUser(email) {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const usersSheet = ss.getSheetByName('Users');
  const data = usersSheet.getDataRange().getValues();
  const headers = data[0];

  // Find column indices
  const cols = {};
  headers.forEach((h, i) => cols[h] = i);

  // Look for existing user
  for (let i = 1; i < data.length; i++) {
    if (data[i][cols['email']] === email) {
      // Update last_login
      usersSheet.getRange(i + 1, cols['last_login'] + 1).setValue(getCurrentTimestamp());

      return {
        id: data[i][cols['id']],
        email: data[i][cols['email']],
        name: data[i][cols['name']],
        avatar_url: data[i][cols['avatar_url']],
        role: data[i][cols['role']],
        status: data[i][cols['status']]
      };
    }
  }

  // Create new user
  const newUser = {
    id: generateUUID(),
    email: email,
    name: getUserDisplayName(),
    avatar_url: getUserPhotoUrl(),
    role: determineInitialRole(email, ss),
    status: 'active',
    created_at: getCurrentTimestamp(),
    last_login: getCurrentTimestamp()
  };

  // Append to sheet
  usersSheet.appendRow([
    newUser.id,
    newUser.email,
    newUser.name,
    newUser.avatar_url,
    newUser.role,
    newUser.status,
    newUser.created_at,
    newUser.last_login
  ]);

  return newUser;
}

/**
 * Get user's display name from Google profile
 */
function getUserDisplayName() {
  try {
    const email = Session.getActiveUser().getEmail();
    // Try to get from directory if available
    // Fallback to email prefix
    return email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  } catch (e) {
    return 'Unknown User';
  }
}

/**
 * Get user's photo URL from Google profile
 */
function getUserPhotoUrl() {
  try {
    // This returns the profile photo if accessible
    return 'https://www.gravatar.com/avatar/?d=mp';
  } catch (e) {
    return 'https://www.gravatar.com/avatar/?d=mp';
  }
}

/**
 * Determine initial role for new user
 */
function determineInitialRole(email, ss) {
  const configSheet = ss.getSheetByName('Config');
  const configData = configSheet.getDataRange().getValues();

  // Check if this is the admin email
  for (let i = 0; i < configData.length; i++) {
    if (configData[i][0] === 'ADMIN_EMAIL' && configData[i][1] === email) {
      return 'admin';
    }
  }

  // Check if no admin is set (first user becomes admin)
  for (let i = 0; i < configData.length; i++) {
    if (configData[i][0] === 'ADMIN_EMAIL' && !configData[i][1]) {
      // Set this user as admin
      configSheet.getRange(i + 1, 2).setValue(email);
      return 'admin';
    }
  }

  // Default to student
  return 'student';
}

/**
 * Check if user is a teacher for a specific class
 */
function isClassTeacher(classId, userId) {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const membersSheet = ss.getSheetByName('ClassMembers');
  const data = membersSheet.getDataRange().getValues();
  const headers = data[0];

  const cols = {};
  headers.forEach((h, i) => cols[h] = i);

  for (let i = 1; i < data.length; i++) {
    if (data[i][cols['class_id']] === classId &&
        data[i][cols['user_id']] === userId &&
        data[i][cols['role']] === 'teacher') {
      return true;
    }
  }
  return false;
}

/**
 * Check if user is admin or teacher
 */
function isAdminOrTeacher(user) {
  return user.role === 'admin' || user.role === 'teacher';
}

/**
 * Check if user can modify artwork
 */
function canModifyArtwork(artworkId, user) {
  if (user.role === 'admin') return true;

  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const artworksSheet = ss.getSheetByName('Artworks');
  const data = artworksSheet.getDataRange().getValues();
  const headers = data[0];

  const cols = {};
  headers.forEach((h, i) => cols[h] = i);

  for (let i = 1; i < data.length; i++) {
    if (data[i][cols['id']] === artworkId) {
      // Owner can modify
      if (data[i][cols['user_id']] === user.id) return true;

      // Teacher of the class can modify
      const collectionId = data[i][cols['collection_id']];
      const classId = getClassIdFromCollection(collectionId);
      if (isClassTeacher(classId, user.id)) return true;

      break;
    }
  }
  return false;
}

/**
 * Get class ID from collection ID
 */
function getClassIdFromCollection(collectionId) {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const collectionsSheet = ss.getSheetByName('Collections');
  const data = collectionsSheet.getDataRange().getValues();
  const headers = data[0];

  const cols = {};
  headers.forEach((h, i) => cols[h] = i);

  for (let i = 1; i < data.length; i++) {
    if (data[i][cols['id']] === collectionId) {
      return data[i][cols['class_id']];
    }
  }
  return null;
}
