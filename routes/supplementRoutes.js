const express = require('express');
const router = express.Router();
const Supplement = require('../models/Supplement');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { uploadToDrive } = require('../utils/googleDrive');

// @desc    Get all supplements
// @route   GET /api/supplements
router.get('/', protect, async (req, res) => {
  try {
    const supplements = await Supplement.find({}).populate('uploadedBy', 'name').sort('-createdAt');
    res.json(supplements);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Add a new supplement
// @route   POST /api/supplements
router.post('/', protect, authorize('Admin', 'Owner'), upload.single('file'), async (req, res) => {
  const { name } = req.body;
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  try {
    const fileUrl = await uploadToDrive(req.file.buffer, req.file.originalname, req.file.mimetype);
    const supplement = await Supplement.create({
      name: name || req.file.originalname,
      fileUrl,
      fileType: req.file.mimetype,
      uploadedBy: req.user._id
    });
    res.status(201).json(supplement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Delete a supplement
// @route   DELETE /api/supplements/:id
router.delete('/:id', protect, authorize('Admin', 'Owner'), async (req, res) => {
  try {
    const supplement = await Supplement.findByIdAndDelete(req.params.id);
    if (!supplement) return res.status(404).json({ message: 'Supplement not found' });
    res.json({ message: 'Supplement removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
