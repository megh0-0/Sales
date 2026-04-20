const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const { protect } = require('../middleware/auth');
const { upload, cloudinary } = require('../middleware/upload');
const { extractTextAndRotate, parseCardIntelligence } = require('../utils/ocr');
const streamifier = require('streamifier');

// Helper to upload Buffer to Cloudinary
const uploadBuffer = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: `sales_pro/${folder}` },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// @desc    OCR for visiting cards
router.post('/ocr', protect, upload.array('images', 2), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ message: 'No images uploaded' });

  try {
    const results = [];
    const rotatedImages = [];

    for (const file of req.files) {
      const { fullText, detections, rotatedImage } = await extractTextAndRotate(file.buffer);
      results.push(parseCardIntelligence(fullText, detections));
      if (rotatedImage) {
        rotatedImages.push(`data:image/jpeg;base64,${rotatedImage.toString('base64')}`);
      }
    }

    // Merge results intelligently
    const mergedData = {
      companyName: '',
      contactPersonName: '',
      designation: '',
      phoneNumbers: [...new Set(results.flatMap(r => r.phoneNumbers))],
      emails: [...new Set(results.flatMap(r => r.emails))],
      addresses: results.flatMap(r => r.addresses).filter(a => a.street.length > 5)
    };

    const corpSuffixes = /Ltd|Limited|Pvt|Inc|Corp/i;
    const namePrefixes = /Engr\.|Md\.|Mr\.|Mohammad/i;

    const allCompanies = results.map(r => r.companyName).filter(c => c);
    mergedData.companyName = allCompanies.find(c => corpSuffixes.test(c)) || allCompanies[0] || '';

    const allNames = results.map(r => r.contactPersonName).filter(n => n);
    mergedData.contactPersonName = allNames.find(n => namePrefixes.test(n)) || allNames[0] || '';

    const allDesigs = results.map(r => r.designation).filter(d => d);
    mergedData.designation = allDesigs[0] || '';

    if (mergedData.addresses.length === 0) mergedData.addresses = [{ street: '', area: '', city: '' }];
    
    res.json({ parsedData: mergedData, rotatedImages });
  } catch (error) {
    console.error('OCR Error:', error);
    res.status(500).json({ message: 'OCR failed', details: error.message });
  }
});

// @desc    Create a new lead
router.post('/', protect, upload.fields([
  { name: 'visitingCardFront', maxCount: 1 },
  { name: 'visitingCardBack', maxCount: 1 },
  { name: 'attachment', maxCount: 1 }
]), async (req, res) => {
  try {
    const leadData = {
      ...req.body,
      enteredBy: req.user._id,
      phoneNumbers: JSON.parse(req.body.phoneNumbers || '[]'),
      emails: JSON.parse(req.body.emails || '[]'),
      addresses: JSON.parse(req.body.addresses || '[]'),
    };

    // Upload files to Cloudinary
    if (req.files['visitingCardFront']) {
      leadData.visitingCardFront = await uploadBuffer(req.files['visitingCardFront'][0].buffer, 'cards');
    }
    if (req.files['visitingCardBack']) {
      leadData.visitingCardBack = await uploadBuffer(req.files['visitingCardBack'][0].buffer, 'cards');
    }
    if (req.files['attachment']) {
      leadData.attachment = await uploadBuffer(req.files['attachment'][0].buffer, 'attachments');
    }

    const lead = await Lead.create(leadData);
    res.status(201).json(lead);
  } catch (error) {
    console.error('Save Error:', error);
    res.status(400).json({ message: 'Failed to create lead', details: error.message });
  }
});

// GET, PUT routes... (keeping them as is)
router.get('/', protect, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'Employee') query.enteredBy = req.user._id;
    const leads = await Lead.find(query).populate('enteredBy', 'name phone').sort('-createdAt');
    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    const updatedLead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedLead);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/status/company', protect, async (req, res) => {
  const { companyName, status } = req.body;
  try {
    const query = { companyName };
    if (req.user.role === 'Employee') query.enteredBy = req.user._id;
    await Lead.updateMany(query, { status });
    res.json({ message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
