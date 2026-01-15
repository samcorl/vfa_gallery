/**
 * VFA Gallery - Google Drive Operations
 */

// ============================================
// ARTWORK UPLOAD & MANAGEMENT
// ============================================

/**
 * Upload artwork image
 */
function uploadArtwork(data, user) {
  // Validate user has a collection in this class
  const collection = getCollectionById(data.collection_id);
  if (!collection) {
    throw new Error('Collection not found');
  }

  if (collection.user_id !== user.id && user.role !== 'admin') {
    throw new Error('You can only upload to your own collection');
  }

  // Decode base64 image
  const imageBlob = Utilities.newBlob(
    Utilities.base64Decode(data.image_data),
    data.mime_type,
    data.file_name
  );

  // Upload to collection folder
  const folder = DriveApp.getFolderById(collection.drive_folder_id);
  const file = folder.createFile(imageBlob);

  // Generate thumbnail
  const thumbBlob = createThumbnail(imageBlob, 400);
  const thumbFile = folder.createFile(thumbBlob);
  thumbFile.setName('thumb_' + data.file_name);

  // Get image dimensions (approximate from blob)
  const dimensions = getImageDimensions(imageBlob);

  // Save to database
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const artworksSheet = ss.getSheetByName('Artworks');

  const artworkId = generateUUID();
  artworksSheet.appendRow([
    artworkId,
    data.collection_id,
    user.id,
    data.title || 'Untitled',
    data.description || '',
    file.getId(),
    thumbFile.getId(),
    data.file_name,
    imageBlob.getBytes().length,
    data.mime_type,
    dimensions.width,
    dimensions.height,
    'visible',
    false,
    getCurrentTimestamp(),
    getCurrentTimestamp()
  ]);

  return {
    id: artworkId,
    file_id: file.getId(),
    thumb_id: thumbFile.getId(),
    url: file.getUrl()
  };
}

/**
 * Update artwork metadata
 */
function updateArtwork(data, user) {
  if (!canModifyArtwork(data.id, user)) {
    throw new Error('You do not have permission to edit this artwork');
  }

  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const artworksSheet = ss.getSheetByName('Artworks');
  const sheetData = artworksSheet.getDataRange().getValues();
  const headers = sheetData[0];

  const cols = {};
  headers.forEach((h, i) => cols[h] = i);

  for (let i = 1; i < sheetData.length; i++) {
    if (sheetData[i][cols['id']] === data.id) {
      if (data.title !== undefined) {
        artworksSheet.getRange(i + 1, cols['title'] + 1).setValue(data.title);
      }
      if (data.description !== undefined) {
        artworksSheet.getRange(i + 1, cols['description'] + 1).setValue(data.description);
      }
      artworksSheet.getRange(i + 1, cols['updated_at'] + 1).setValue(getCurrentTimestamp());
      return { success: true };
    }
  }

  throw new Error('Artwork not found');
}

/**
 * Delete artwork (marks as deleted, doesn't remove files)
 */
function deleteArtwork(artworkId, user) {
  if (!canModifyArtwork(artworkId, user)) {
    throw new Error('You do not have permission to delete this artwork');
  }

  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const artworksSheet = ss.getSheetByName('Artworks');
  const data = artworksSheet.getDataRange().getValues();
  const headers = data[0];

  const cols = {};
  headers.forEach((h, i) => cols[h] = i);

  for (let i = 1; i < data.length; i++) {
    if (data[i][cols['id']] === artworkId) {
      artworksSheet.getRange(i + 1, cols['status'] + 1).setValue('deleted');
      artworksSheet.getRange(i + 1, cols['updated_at'] + 1).setValue(getCurrentTimestamp());
      return { success: true };
    }
  }

  throw new Error('Artwork not found');
}

/**
 * Toggle featured status
 */
function featureArtwork(artworkId, featured, user) {
  if (!isAdminOrTeacher(user)) {
    throw new Error('Only teachers can feature artwork');
  }

  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const artworksSheet = ss.getSheetByName('Artworks');
  const data = artworksSheet.getDataRange().getValues();
  const headers = data[0];

  const cols = {};
  headers.forEach((h, i) => cols[h] = i);

  for (let i = 1; i < data.length; i++) {
    if (data[i][cols['id']] === artworkId) {
      artworksSheet.getRange(i + 1, cols['featured'] + 1).setValue(featured);
      artworksSheet.getRange(i + 1, cols['updated_at'] + 1).setValue(getCurrentTimestamp());

      // If featuring, optionally copy to featured folder
      if (featured) {
        copyToFeaturedFolder(data[i][cols['drive_file_id']]);
      }

      return { success: true };
    }
  }

  throw new Error('Artwork not found');
}

/**
 * Toggle hidden status
 */
function hideArtwork(artworkId, hidden, user) {
  if (!isAdminOrTeacher(user)) {
    throw new Error('Only teachers can hide artwork');
  }

  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const artworksSheet = ss.getSheetByName('Artworks');
  const data = artworksSheet.getDataRange().getValues();
  const headers = data[0];

  const cols = {};
  headers.forEach((h, i) => cols[h] = i);

  for (let i = 1; i < data.length; i++) {
    if (data[i][cols['id']] === artworkId) {
      artworksSheet.getRange(i + 1, cols['status'] + 1).setValue(hidden ? 'hidden' : 'visible');
      artworksSheet.getRange(i + 1, cols['updated_at'] + 1).setValue(getCurrentTimestamp());
      return { success: true };
    }
  }

  throw new Error('Artwork not found');
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get collection by ID
 */
function getCollectionById(collectionId) {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const collectionsSheet = ss.getSheetByName('Collections');
  const data = collectionsSheet.getDataRange().getValues();
  const headers = data[0];

  const cols = {};
  headers.forEach((h, i) => cols[h] = i);

  for (let i = 1; i < data.length; i++) {
    if (data[i][cols['id']] === collectionId) {
      return {
        id: data[i][cols['id']],
        class_id: data[i][cols['class_id']],
        user_id: data[i][cols['user_id']],
        name: data[i][cols['name']],
        drive_folder_id: data[i][cols['drive_folder_id']]
      };
    }
  }
  return null;
}

/**
 * Create a thumbnail from an image blob
 * Note: Apps Script has limited image manipulation
 * This uses Drive's built-in thumbnail capability
 */
function createThumbnail(imageBlob, maxSize) {
  // For now, just return the original - Drive generates thumbnails automatically
  // A more sophisticated implementation could use external services
  return imageBlob;
}

/**
 * Get image dimensions from blob
 * Note: This is approximate - Apps Script doesn't have built-in image dimension reading
 */
function getImageDimensions(imageBlob) {
  // Return placeholder dimensions
  // Actual implementation would need to parse image headers
  return { width: 0, height: 0 };
}

/**
 * Copy file to featured folder
 */
function copyToFeaturedFolder(fileId) {
  try {
    const config = getConfig();
    const rootFolder = DriveApp.getFolderById(config.DRIVE_FOLDER_ID);
    const featuredFolder = getOrCreateSubfolder(rootFolder, 'featured');

    const file = DriveApp.getFileById(fileId);
    file.makeCopy(file.getName(), featuredFolder);
  } catch (e) {
    console.error('Failed to copy to featured folder:', e);
  }
}

/**
 * Get artwork image URL for display
 */
function getArtworkImageUrl(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    // Return a thumbnail URL that works without authentication
    return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w800';
  } catch (e) {
    return null;
  }
}

/**
 * Get artworks for a collection
 */
function getCollectionArtworks(collectionId) {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const artworksSheet = ss.getSheetByName('Artworks');
  const data = artworksSheet.getDataRange().getValues();
  const headers = data[0];

  const cols = {};
  headers.forEach((h, i) => cols[h] = i);

  const artworks = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][cols['collection_id']] === collectionId && data[i][cols['status']] !== 'deleted') {
      artworks.push({
        id: data[i][cols['id']],
        title: data[i][cols['title']],
        description: data[i][cols['description']],
        file_id: data[i][cols['drive_file_id']],
        thumb_id: data[i][cols['drive_thumb_id']],
        status: data[i][cols['status']],
        featured: data[i][cols['featured']],
        created_at: data[i][cols['created_at']],
        image_url: getArtworkImageUrl(data[i][cols['drive_file_id']]),
        thumb_url: getArtworkImageUrl(data[i][cols['drive_thumb_id']])
      });
    }
  }

  return artworks;
}

/**
 * Get featured artworks
 */
function getFeaturedArtworks() {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const artworksSheet = ss.getSheetByName('Artworks');
  const data = artworksSheet.getDataRange().getValues();
  const headers = data[0];

  const cols = {};
  headers.forEach((h, i) => cols[h] = i);

  const artworks = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][cols['featured']] === true && data[i][cols['status']] === 'visible') {
      artworks.push({
        id: data[i][cols['id']],
        title: data[i][cols['title']],
        description: data[i][cols['description']],
        file_id: data[i][cols['drive_file_id']],
        thumb_id: data[i][cols['drive_thumb_id']],
        created_at: data[i][cols['created_at']],
        image_url: getArtworkImageUrl(data[i][cols['drive_file_id']]),
        thumb_url: getArtworkImageUrl(data[i][cols['drive_thumb_id']])
      });
    }
  }

  return artworks;
}
