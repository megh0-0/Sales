const multer = require('multer');

// Store files in memory so we can process them before uploading to Drive
const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

module.exports = { upload };
