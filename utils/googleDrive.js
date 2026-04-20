const { google } = require('googleapis');
const fs = require('fs');
const stream = require('stream');

// Initialize Drive API
// Requires GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON in environment
let drive = null;

try {
  const credentials = JSON.parse(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  drive = google.drive({ version: 'v3', auth });
} catch (error) {
  console.error('Google Drive Auth Error:', error.message);
}

/**
 * Upload a file to Google Drive
 * @param {Buffer|string} fileSource Buffer or Local Path
 * @param {string} fileName 
 * @param {string} mimeType 
 * @returns {Promise<string>} Web view link
 */
async function uploadToDrive(fileSource, fileName, mimeType) {
  if (!drive) throw new Error('Google Drive not configured.');

  try {
    // POWERFUL ID EXTRACTION: Handles raw IDs, full URLs, and mobile share links
    const rawInput = (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();
    const idMatch = rawInput.match(/([a-zA-Z0-9_-]{25,})($|[/?&])/);
    const folderId = idMatch ? idMatch[1] : rawInput;

    console.log(`Uploading to Drive ID: ${folderId}`);

    let fileStream;
    if (Buffer.isBuffer(fileSource)) {
      fileStream = new stream.PassThrough();
      fileStream.end(fileSource);
    } else {
      fileStream = fs.createReadStream(fileSource);
    }

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType: mimeType,
        body: fileStream,
      },
      // Important flags for complex sharing environments
      supportsAllDrives: true,
      fields: 'id, webViewLink'
    });

    const fileId = response.data.id;

    // Grant permission so the link is viewable in the app
    await drive.permissions.create({
      fileId: fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    });

    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  } catch (error) {
    console.error('Drive Upload Error:', error);
    throw error;
  }
}

module.exports = { uploadToDrive };
