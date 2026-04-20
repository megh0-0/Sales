const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { extractTextAndRotate, parseCardIntelligence } = require('../utils/ocr');
const { uploadToDrive } = require('../utils/googleDrive');

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

    const processUpload = async (fileKey, fileName) => {
      if (req.files[fileKey]) {
        const file = req.files[fileKey][0];
        return await uploadToDrive(file.buffer, `${Date.now()}_${fileName}`, file.mimetype);
      }
      return null;
    };

    const frontUrl = await processUpload('visitingCardFront', 'card_front.jpg');
    if (frontUrl) leadData.visitingCardFront = frontUrl;

    const backUrl = await processUpload('visitingCardBack', 'card_back.jpg');
    if (backUrl) leadData.visitingCardBack = backUrl;

    const attachUrl = await processUpload('attachment', 'attachment_file');
    if (attachUrl) leadData.attachment = attachUrl;

    const lead = await Lead.create(leadData);
    res.status(201).json(lead);
  } catch (error) {
    console.error('Save Error:', error);
    res.status(400).json({ message: 'Failed to create lead', details: error.message });
  }
});

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
