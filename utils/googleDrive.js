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
    // Sanitize Folder ID (handle full URL or accidental dots/spaces)
    let folderId = (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();
    if (folderId.includes('/folders/')) {
      folderId = folderId.split('/folders/')[1].split('?')[0].split('/')[0];
    }
    folderId = folderId.replace(/[./]+$/, ''); // Remove trailing dots or slashes

    console.log(`Uploading ${fileName} to Drive Folder: ${folderId}`);

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
    });

    const fileId = response.data.id;

    // Make file public or shared (Optional, depends on how you want to view them)
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // Get the web link
    const result = await drive.files.get({
      fileId: fileId,
      fields: 'webViewLink, webContentLink, thumbnailLink',
    });

    // We return a direct download link which works better for <img> tags
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  } catch (error) {
    console.error('Drive Upload Error:', error);
    throw error;
  }
}

module.exports = { uploadToDrive };
