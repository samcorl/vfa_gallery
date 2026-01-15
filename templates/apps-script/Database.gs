/**
 * VFA Gallery - Database Operations (Google Sheets)
 */

// ============================================
// CLASS MANAGEMENT
// ============================================

/**
 * Create a new class gallery
 */
function createClass(data, user) {
  if (!isAdminOrTeacher(user)) {
    throw new Error('Only teachers can create classes');
  }

  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const classesSheet = ss.getSheetByName('Classes');

  // Create Drive folder for this class
  const rootFolder = DriveApp.getFolderById(config.DRIVE_FOLDER_ID);
  const classesFolder = getOrCreateSubfolder(rootFolder, 'classes');
  const slug = slugify(data.name);
  const classFolder = classesFolder.createFolder(slug);

  const classId = generateUUID();
  const newClass = {
    id: classId,
    name: data.name,
    description: data.description || '',
    slug: slug,
    drive_folder_id: classFolder.getId(),
    status: 'active',
    theme_id: data.theme_id || '',
    created_by: user.id,
    created_at: getCurrentTimestamp(),
    archived_at: ''
  };

  classesSheet.appendRow([
    newClass.id,
    newClass.name,
    newClass.description,
    newClass.slug,
    newClass.drive_folder_id,
    newClass.status,
    newClass.theme_id,
    newClass.created_by,
    newClass.created_at,
    newClass.archived_at
  ]);

  // Add creator as teacher
  addClassMember(classId, user.email, 'teacher', user);

  return newClass;
}

/**
 * Archive a class
 */
function archiveClass(classId, user) {
  if (!isClassTeacher(classId, user.id) && user.role !== 'admin') {
    throw new Error('Only class teachers can archive classes');
  }

  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const classesSheet = ss.getSheetByName('Classes');
  const data = classesSheet.getDataRange().getValues();
  const headers = data[0];

  const cols = {};
  headers.forEach((h, i) => cols[h] = i);

  for (let i = 1; i < data.length; i++) {
    if (data[i][cols['id']] === classId) {
      classesSheet.getRange(i + 1, cols['status'] + 1).setValue('archived');
      classesSheet.getRange(i + 1, cols['archived_at'] + 1).setValue(getCurrentTimestamp());
      return { success: true };
    }
  }

  throw new Error('Class not found');
}

/**
 * Get all classes (optionally filtered by status)
 */
function getClasses(status = null) {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const classesSheet = ss.getSheetByName('Classes');
  const data = classesSheet.getDataRange().getValues();
  const headers = data[0];

  const cols = {};
  headers.forEach((h, i) => cols[h] = i);

  const classes = [];
  for (let i = 1; i < data.length; i++) {
    if (!status || data[i][cols['status']] === status) {
      classes.push({
        id: data[i][cols['id']],
        name: data[i][cols['name']],
        description: data[i][cols['description']],
        slug: data[i][cols['slug']],
        status: data[i][cols['status']],
        created_at: data[i][cols['created_at']]
      });
    }
  }

  return classes;
}

// ============================================
// CLASS MEMBER MANAGEMENT
// ============================================

/**
 * Add a member to a class
 */
function addClassMember(classId, email, role, user) {
  if (!isClassTeacher(classId, user.id) && user.role !== 'admin') {
    throw new Error('Only class teachers can add members');
  }

  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);

  // Get or create the user
  const memberUser = getOrCreateUser(email);

  // Check if already a member
  const membersSheet = ss.getSheetByName('ClassMembers');
  const data = membersSheet.getDataRange().getValues();
  const headers = data[0];

  const cols = {};
  headers.forEach((h, i) => cols[h] = i);

  for (let i = 1; i < data.length; i++) {
    if (data[i][cols['class_id']] === classId && data[i][cols['user_id']] === memberUser.id) {
      throw new Error('User is already a member of this class');
    }
  }

  // Add member
  const memberId = generateUUID();
  membersSheet.appendRow([
    memberId,
    classId,
    memberUser.id,
    role,
    user.id,
    getCurrentTimestamp()
  ]);

  // Create collection for student
  if (role === 'student') {
    createCollectionForStudent(classId, memberUser);
  }

  return { success: true, memberId: memberId };
}

/**
 * Remove a member from a class
 */
function removeClassMember(classId, userId, user) {
  if (!isClassTeacher(classId, user.id) && user.role !== 'admin') {
    throw new Error('Only class teachers can remove members');
  }

  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const membersSheet = ss.getSheetByName('ClassMembers');
  const data = membersSheet.getDataRange().getValues();
  const headers = data[0];

  const cols = {};
  headers.forEach((h, i) => cols[h] = i);

  for (let i = 1; i < data.length; i++) {
    if (data[i][cols['class_id']] === classId && data[i][cols['user_id']] === userId) {
      membersSheet.deleteRow(i + 1);
      return { success: true };
    }
  }

  throw new Error('Member not found');
}

/**
 * Get members of a class
 */
function getClassMembers(classId) {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const membersSheet = ss.getSheetByName('ClassMembers');
  const usersSheet = ss.getSheetByName('Users');

  const membersData = membersSheet.getDataRange().getValues();
  const usersData = usersSheet.getDataRange().getValues();

  const memberHeaders = membersData[0];
  const userHeaders = usersData[0];

  const memberCols = {};
  memberHeaders.forEach((h, i) => memberCols[h] = i);

  const userCols = {};
  userHeaders.forEach((h, i) => userCols[h] = i);

  // Build user lookup
  const userLookup = {};
  for (let i = 1; i < usersData.length; i++) {
    userLookup[usersData[i][userCols['id']]] = {
      id: usersData[i][userCols['id']],
      email: usersData[i][userCols['email']],
      name: usersData[i][userCols['name']],
      avatar_url: usersData[i][userCols['avatar_url']]
    };
  }

  const members = [];
  for (let i = 1; i < membersData.length; i++) {
    if (membersData[i][memberCols['class_id']] === classId) {
      const userId = membersData[i][memberCols['user_id']];
      const userData = userLookup[userId] || {};
      members.push({
        ...userData,
        role: membersData[i][memberCols['role']],
        added_at: membersData[i][memberCols['added_at']]
      });
    }
  }

  return members;
}

// ============================================
// COLLECTION MANAGEMENT
// ============================================

/**
 * Create a collection for a student in a class
 */
function createCollectionForStudent(classId, studentUser) {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const collectionsSheet = ss.getSheetByName('Collections');
  const classesSheet = ss.getSheetByName('Classes');

  // Get class folder
  const classData = classesSheet.getDataRange().getValues();
  const classHeaders = classData[0];
  const classCols = {};
  classHeaders.forEach((h, i) => classCols[h] = i);

  let classFolderId = null;
  for (let i = 1; i < classData.length; i++) {
    if (classData[i][classCols['id']] === classId) {
      classFolderId = classData[i][classCols['drive_folder_id']];
      break;
    }
  }

  if (!classFolderId) {
    throw new Error('Class folder not found');
  }

  // Create student folder
  const classFolder = DriveApp.getFolderById(classFolderId);
  const studentSlug = slugify(studentUser.name || studentUser.email.split('@')[0]);
  const studentFolder = classFolder.createFolder(studentSlug);

  const collectionId = generateUUID();
  collectionsSheet.appendRow([
    collectionId,
    classId,
    studentUser.id,
    studentUser.name || 'My Collection',
    '',
    studentFolder.getId(),
    '',
    getCurrentTimestamp()
  ]);

  return collectionId;
}

/**
 * Get collections for a user
 */
function getUserCollections(userId) {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const collectionsSheet = ss.getSheetByName('Collections');
  const classesSheet = ss.getSheetByName('Classes');

  const collectionsData = collectionsSheet.getDataRange().getValues();
  const classesData = classesSheet.getDataRange().getValues();

  const collectionHeaders = collectionsData[0];
  const classHeaders = classesData[0];

  const collCols = {};
  collectionHeaders.forEach((h, i) => collCols[h] = i);

  const classCols = {};
  classHeaders.forEach((h, i) => classCols[h] = i);

  // Build class lookup
  const classLookup = {};
  for (let i = 1; i < classesData.length; i++) {
    classLookup[classesData[i][classCols['id']]] = {
      name: classesData[i][classCols['name']],
      status: classesData[i][classCols['status']]
    };
  }

  const collections = [];
  for (let i = 1; i < collectionsData.length; i++) {
    if (collectionsData[i][collCols['user_id']] === userId) {
      const classId = collectionsData[i][collCols['class_id']];
      const classInfo = classLookup[classId] || {};
      collections.push({
        id: collectionsData[i][collCols['id']],
        class_id: classId,
        class_name: classInfo.name,
        class_status: classInfo.status,
        name: collectionsData[i][collCols['name']],
        description: collectionsData[i][collCols['description']],
        created_at: collectionsData[i][collCols['created_at']]
      });
    }
  }

  return collections;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert string to URL-safe slug
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .substring(0, 50);
}

/**
 * Get or create a subfolder
 */
function getOrCreateSubfolder(parentFolder, name) {
  const folders = parentFolder.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(name);
}
