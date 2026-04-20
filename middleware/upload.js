const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary using your existing credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// We'll use memory storage to allow for auto-rotation/resizing before upload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

module.exports = { upload, cloudinary };
