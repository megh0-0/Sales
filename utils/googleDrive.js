const { google } = require('googleapis');
const fs = require('fs');
const stream = require('stream');

/**
 * Upload a file to Google Drive using OAuth2 (Personal Account)
 */
async function uploadToDrive(fileSource, fileName, mimeType) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      console.error('Missing Google OAuth2 Environment Variables:', {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
        hasRefreshToken: !!refreshToken
      });
      throw new Error('Google OAuth2 configuration is incomplete. Check GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in Render.');
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Clean Folder ID
    const rawInput = (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();
    const idMatch = rawInput.match(/([a-zA-Z0-9_-]{25,})($|[/?&])/);
    const folderId = idMatch ? idMatch[1] : rawInput;

    console.log(`Uploading to Drive (Personal Quota) ID: ${folderId}`);

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
      fields: 'id',
    });

    const fileId = response.data.id;

    // Grant public view permission
    await drive.permissions.create({
      fileId: fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  } catch (error) {
    console.error('Personal Drive Upload Error:', error.message);
    throw error;
  }
}

module.exports = { uploadToDrive };
