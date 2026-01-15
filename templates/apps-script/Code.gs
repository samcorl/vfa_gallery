/**
 * VFA Gallery - Google Apps Script Web App
 * Main entry point and routing
 */

// ============================================
// CONFIGURATION
// ============================================

function getConfig() {
  const scriptProperties = PropertiesService.getScriptProperties();
  return {
    SPREADSHEET_ID: scriptProperties.getProperty('SPREADSHEET_ID'),
    DRIVE_FOLDER_ID: scriptProperties.getProperty('DRIVE_FOLDER_ID')
  };
}

// ============================================
// WEB APP ENTRY POINTS
// ============================================

/**
 * Handles GET requests - serves the web app
 */
function doGet(e) {
  const path = e.parameter.path || 'home';
  const template = HtmlService.createTemplateFromFile('index');
  template.initialPath = path;
  template.user = getCurrentUser();

  return template.evaluate()
    .setTitle(getGalleryName())
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Handles POST requests - API endpoints
 */
function doPost(e) {
  try {
    const action = e.parameter.action;
    const data = JSON.parse(e.postData.contents || '{}');

    // Verify user is authenticated
    const user = getCurrentUser();
    if (!user) {
      return jsonResponse({ error: 'Not authenticated' }, 401);
    }

    // Route to appropriate handler
    let result;
    switch (action) {
      // Class management
      case 'createClass':
        result = createClass(data, user);
        break;
      case 'archiveClass':
        result = archiveClass(data.classId, user);
        break;
      case 'addClassMember':
        result = addClassMember(data.classId, data.email, data.role, user);
        break;
      case 'removeClassMember':
        result = removeClassMember(data.classId, data.userId, user);
        break;

      // Artwork management
      case 'uploadArtwork':
        result = uploadArtwork(data, user);
        break;
      case 'updateArtwork':
        result = updateArtwork(data, user);
        break;
      case 'deleteArtwork':
        result = deleteArtwork(data.artworkId, user);
        break;
      case 'featureArtwork':
        result = featureArtwork(data.artworkId, data.featured, user);
        break;
      case 'hideArtwork':
        result = hideArtwork(data.artworkId, data.hidden, user);
        break;

      // Theme management
      case 'createTheme':
        result = createTheme(data, user);
        break;
      case 'applyTheme':
        result = applyTheme(data.targetType, data.targetId, data.themeId, user);
        break;

      default:
        return jsonResponse({ error: 'Unknown action' }, 400);
    }

    return jsonResponse(result);

  } catch (error) {
    console.error('doPost error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Include HTML file content (for templates)
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Return JSON response
 */
function jsonResponse(data, statusCode = 200) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Get gallery name from Config sheet
 */
function getGalleryName() {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const configSheet = ss.getSheetByName('Config');
  const data = configSheet.getDataRange().getValues();

  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === 'GALLERY_NAME') {
      return data[i][1] || 'Art Gallery';
    }
  }
  return 'Art Gallery';
}

/**
 * Generate a UUID
 */
function generateUUID() {
  return Utilities.getUuid();
}

/**
 * Get current timestamp in ISO format
 */
function getCurrentTimestamp() {
  return new Date().toISOString();
}
