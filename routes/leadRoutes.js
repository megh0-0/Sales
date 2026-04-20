const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { extractText, parseCardText } = require('../utils/ocr');
const fs = require('fs');

// @desc    OCR for visiting cards
// @route   POST /api/leads/ocr
router.post('/ocr', protect, upload.array('images', 2), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ message: 'No images uploaded' });

  try {
    let combinedText = '';
    const results = [];
    const croppedImages = [];

    // Process each image
    for (const file of req.files) {
      const { text, croppedImage } = await extractTextAndCrop(file.path);
      combinedText += '\n' + text;
      results.push(parseCardText(text));
      
      if (croppedImage) {
        // In a real production app, we would upload this cropped buffer to Drive/Cloudinary
        // For the autofill preview, we can return it as a base64 string
        croppedImages.push(`data:image/jpeg;base64,${croppedImage.toString('base64')}`);
      }
    }

    // Merge results
    const mergedData = {
      companyName: results.find(r => r.companyName)?.companyName || '',
      contactPersonName: results.find(r => r.contactPersonName)?.contactPersonName || '',
      designation: results.find(r => r.designation)?.designation || '',
      phoneNumbers: [...new Set(results.flatMap(r => r.phoneNumbers))],
      emails: [...new Set(results.flatMap(r => r.emails))],
      addresses: results.flatMap(r => r.addresses).filter(a => a.street.length > 5)
    };

    if (mergedData.addresses.length === 0) {
      mergedData.addresses = [{ street: '', area: '', city: '' }];
    }
    
    res.json({ text: combinedText, parsedData: mergedData, croppedImages });
  } catch (error) {
    console.error('OCR Route Error:', error);
    res.status(500).json({ 
      message: 'OCR processing failed', 
      details: error.message,
      suggestion: 'Check if Google Vision API key is valid and Secret File is uploaded to Render.'
    });
  }
});

// @desc    Create a new lead
// @route   POST /api/leads
// Handling multiple images and one attachment
router.post('/', protect, upload.fields([
  { name: 'visitingCardFront', maxCount: 1 },
  { name: 'visitingCardBack', maxCount: 1 },
  { name: 'attachment', maxCount: 1 }
]), async (req, res) => {
  try {
    const leadData = {
      ...req.body,
      enteredBy: req.user._id,
      phoneNumbers: typeof req.body.phoneNumbers === 'string' ? JSON.parse(req.body.phoneNumbers) : req.body.phoneNumbers,
      emails: typeof req.body.emails === 'string' ? JSON.parse(req.body.emails) : req.body.emails,
      addresses: typeof req.body.addresses === 'string' ? JSON.parse(req.body.addresses) : req.body.addresses,
    };

    if (req.files['visitingCardFront']) leadData.visitingCardFront = req.files['visitingCardFront'][0].path;
    if (req.files['visitingCardBack']) leadData.visitingCardBack = req.files['visitingCardBack'][0].path;
    if (req.files['attachment']) leadData.attachment = req.files['attachment'][0].path;

    const lead = await Lead.create(leadData);
    res.status(201).json(lead);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message });
  }
});

// @desc    Get all leads (with RBAC)
// @route   GET /api/leads
router.get('/', protect, async (req, res) => {
  try {
    let query = {};
    // Employee only sees own data
    if (req.user.role === 'Employee') {
      query.enteredBy = req.user._id;
    }

    // Sorting by createdAt (entried date) descending
    const leads = await Lead.find(query)
      .populate('enteredBy', 'name phone')
      .sort('-createdAt');
    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Update a lead
// @route   PUT /api/leads/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    // Only owner of lead or Manager/Admin/Owner can edit
    if (req.user.role === 'Employee' && lead.enteredBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this lead' });
    }

    const updatedLead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedLead);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update status for all leads of a company
// @route   PUT /api/leads/status/company
router.put('/status/company', protect, async (req, res) => {
  const { companyName, status } = req.body;
  try {
    const query = { companyName };
    if (req.user.role === 'Employee') {
      query.enteredBy = req.user._id;
    }
    await Lead.updateMany(query, { status });
    res.json({ message: 'Status updated for all company leads' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get report data (Daily, Weekly, Monthly)
// @route   GET /api/leads/reports
router.get('/reports', protect, async (req, res) => {
  try {
    let match = {};
    if (req.user.role === 'Employee') {
      match.enteredBy = req.user._id;
    }

    // Basic aggregation for daily counts in the last 30 days
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    match.createdAt = { $gte: last30Days };

    const dailyReport = await Lead.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // Add Weekly and Monthly as well
    const monthlyReport = await Lead.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    res.json({ daily: dailyReport, monthly: monthlyReport });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
