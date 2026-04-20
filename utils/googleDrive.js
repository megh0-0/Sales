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
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID], // Optional: Upload to specific folder
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
      fields: 'webViewLink, webContentLink',
    });

    return result.data.webViewLink;
  } catch (error) {
    console.error('Drive Upload Error:', error);
    throw error;
  }
}

module.exports = { uploadToDrive };
