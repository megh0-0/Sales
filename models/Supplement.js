const mongoose = require('mongoose');

const supplementSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  fileUrl: { type: String, required: true },
  fileType: { type: String },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Supplement', supplementSchema);
