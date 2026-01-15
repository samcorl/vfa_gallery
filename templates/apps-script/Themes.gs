/**
 * VFA Gallery - Theme Management
 */

/**
 * Create a custom theme
 */
function createTheme(data, user) {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const themesSheet = ss.getSheetByName('Themes');

  const themeId = generateUUID();
  themesSheet.appendRow([
    themeId,
    data.name,
    'custom',
    data.background_color || '#ffffff',
    data.text_color || '#1a1a1a',
    data.accent_color || '#2563eb',
    data.card_style || 'light',
    user.id,
    getCurrentTimestamp()
  ]);

  return { id: themeId };
}

/**
 * Apply a theme to a class or collection
 */
function applyTheme(targetType, targetId, themeId, user) {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);

  let sheet;
  if (targetType === 'class') {
    // Verify user is teacher of this class
    if (!isClassTeacher(targetId, user.id) && user.role !== 'admin') {
      throw new Error('Only class teachers can change class theme');
    }
    sheet = ss.getSheetByName('Classes');
  } else if (targetType === 'collection') {
    // Verify user owns this collection or is teacher
    const collection = getCollectionById(targetId);
    if (collection.user_id !== user.id && user.role !== 'admin') {
      throw new Error('You can only change your own collection theme');
    }
    sheet = ss.getSheetByName('Collections');
  } else {
    throw new Error('Invalid target type');
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const cols = {};
  headers.forEach((h, i) => cols[h] = i);

  for (let i = 1; i < data.length; i++) {
    if (data[i][cols['id']] === targetId) {
      sheet.getRange(i + 1, cols['theme_id'] + 1).setValue(themeId);
      return { success: true };
    }
  }

  throw new Error('Target not found');
}

/**
 * Get all available themes
 */
function getThemes(user) {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const themesSheet = ss.getSheetByName('Themes');
  const data = themesSheet.getDataRange().getValues();
  const headers = data[0];

  const cols = {};
  headers.forEach((h, i) => cols[h] = i);

  const themes = [];
  for (let i = 1; i < data.length; i++) {
    // Include system themes and user's own themes
    if (data[i][cols['type']] === 'system' || data[i][cols['created_by']] === user.id) {
      themes.push({
        id: data[i][cols['id']],
        name: data[i][cols['name']],
        type: data[i][cols['type']],
        background_color: data[i][cols['background_color']],
        text_color: data[i][cols['text_color']],
        accent_color: data[i][cols['accent_color']],
        card_style: data[i][cols['card_style']]
      });
    }
  }

  return themes;
}

/**
 * Get theme by ID
 */
function getThemeById(themeId) {
  if (!themeId) return null;

  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const themesSheet = ss.getSheetByName('Themes');
  const data = themesSheet.getDataRange().getValues();
  const headers = data[0];

  const cols = {};
  headers.forEach((h, i) => cols[h] = i);

  for (let i = 1; i < data.length; i++) {
    if (data[i][cols['id']] === themeId) {
      return {
        id: data[i][cols['id']],
        name: data[i][cols['name']],
        type: data[i][cols['type']],
        background_color: data[i][cols['background_color']],
        text_color: data[i][cols['text_color']],
        accent_color: data[i][cols['accent_color']],
        card_style: data[i][cols['card_style']]
      };
    }
  }

  return null;
}

/**
 * Delete a custom theme
 */
function deleteTheme(themeId, user) {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const themesSheet = ss.getSheetByName('Themes');
  const data = themesSheet.getDataRange().getValues();
  const headers = data[0];

  const cols = {};
  headers.forEach((h, i) => cols[h] = i);

  for (let i = 1; i < data.length; i++) {
    if (data[i][cols['id']] === themeId) {
      // Can't delete system themes
      if (data[i][cols['type']] === 'system') {
        throw new Error('Cannot delete system themes');
      }
      // Only creator or admin can delete
      if (data[i][cols['created_by']] !== user.id && user.role !== 'admin') {
        throw new Error('You can only delete your own themes');
      }
      themesSheet.deleteRow(i + 1);
      return { success: true };
    }
  }

  throw new Error('Theme not found');
}
