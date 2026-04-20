const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { extractTextAndRotate, parseCardIntelligence } = require('../utils/ocr');
const { uploadToDrive } = require('../utils/googleDrive');

// @desc    OCR for visiting cards
// @route   POST /api/leads/ocr
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

    // Intelligence-based merging
    const mergedData = {
      companyName: '',
      contactPersonName: '',
      designation: '',
      phoneNumbers: [...new Set(results.flatMap(r => r.phoneNumbers))],
      emails: [...new Set(results.flatMap(r => r.emails))],
      addresses: results.flatMap(r => r.addresses).filter(a => a.street.length > 5)
    };

    const desigKeywords = ['Officer', 'Manager', 'Director', 'CEO', 'Founder', 'Sales', 'Executive', 'Owner', 'Partner', 'President', 'Consultant', 'Proprietor', 'V.P.', 'Chief', 'Lead', 'Associate', 'Representative', 'Prop.', 'Chairman', 'Technician'];
    const namePrefixes = ['Engr.', 'Md.', 'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Mohammad', 'S.M.', 'Sheikh'];

    // 1. Merge Company: Strongly prioritize lines with actual corporate suffixes
    const allCompanies = results.map(r => r.companyName).filter(c => c);
    const bestCompany = allCompanies.find(c => /Ltd|Limited|Pvt|Inc|Corp/i.test(c));
    // Filter out potential designations or names from company field
    const cleanCompanies = allCompanies.filter(c => 
      !desigKeywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(c)) &&
      !namePrefixes.some(p => c.includes(p))
    );
    mergedData.companyName = bestCompany || cleanCompanies[0] || allCompanies[0] || '';

    // 2. Merge Name: Prioritize lines with prefixes (Engr., Md.)
    const allNames = results.map(r => r.contactPersonName).filter(n => n);
    const bestName = allNames.find(n => namePrefixes.some(p => n.includes(p)));
    // Filter out potential designations from name field
    const cleanNames = allNames.filter(n => !desigKeywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(n)));
    mergedData.contactPersonName = bestName || cleanNames[0] || allNames[0] || '';

    // 3. Merge Designation: Find the one that actually looks like a job title
    const allDesigs = results.map(r => r.designation).filter(d => d);
    mergedData.designation = allDesigs.find(d => desigKeywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(d))) || allDesigs[0] || '';

    if (mergedData.addresses.length === 0) {
      mergedData.addresses = [{ street: '', area: '', city: '' }];
    }
    
    res.json({ parsedData: mergedData, rotatedImages });
  } catch (error) {
    console.error('OCR Error:', error);
    res.status(500).json({ message: 'OCR failed', details: error.message });
  }
});

// @desc    Create a new lead
// @route   POST /api/leads
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

    // Helper to process and upload
    const processUpload = async (fileKey, fileName) => {
      if (req.files[fileKey]) {
        const file = req.files[fileKey][0];
        return await uploadToDrive(file.buffer, `${Date.now()}_${fileName}`, file.mimetype);
      }
      return null;
    };

    // Upload files to Google Drive
    const frontUrl = await processUpload('visitingCardFront', 'card_front.jpg');
    if (frontUrl) leadData.visitingCardFront = frontUrl;

    const backUrl = await processUpload('visitingCardBack', 'card_back.jpg');
    if (backUrl) leadData.visitingCardBack = backUrl;

    const attachUrl = await processUpload('attachment', 'attachment_file');
    if (attachUrl) leadData.attachment = attachUrl;

    const lead = await Lead.create(leadData);
    res.status(201).json(lead);
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(400).json({ message: 'Failed to create lead', details: error.message });
  }
});

// @desc    Get all leads
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

// @desc    Update a lead
router.put('/:id', protect, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    if (req.user.role === 'Employee' && lead.enteredBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const updatedLead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedLead);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update status for all leads of a company
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
