const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { extractTextAndRotate, parseCardIntelligence } = require('../utils/ocr');
const { uploadToDrive, createDriveFolder } = require('../utils/googleDrive');
const { sendPushNotification } = require('./notificationRoutes');

// @desc    OCR for visiting cards
router.post('/ocr', protect, upload.array('images', 2), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ message: 'No images uploaded' });
  try {
    const contextLeads = await Lead.find({ status: { $ne: 'Reject' } }).sort('-createdAt').limit(20).select('companyName contactPersonName designation industry');
    
    // Process images in parallel for speed
    const processPromises = req.files.map(async (file) => {
      const { fullText, detections, rotatedImage, qrData } = await extractTextAndRotate(file.buffer);
      // IMPORTANT: Pass the rotatedImage (buffer) to Gemini, not the original raw buffer
      const parsed = await parseCardIntelligence(fullText, detections, qrData, contextLeads, rotatedImage);
      return { parsed, rotatedImage };
    });

    const processedResults = await Promise.all(processPromises);
    
    const results = [];
    const rotatedImages = [];
    
    processedResults.forEach(({ parsed, rotatedImage }) => {
      results.push(parsed);
      if (rotatedImage) rotatedImages.push(`data:image/jpeg;base64,${rotatedImage.toString('base64')}`);
    });

    const mergedData = {
      companyName: '', contactPersonName: '', designation: '',
      phoneNumbers: [...new Set(results.flatMap(r => r.phoneNumbers))],
      emails: [...new Set(results.flatMap(r => r.emails))],
      addresses: results.flatMap(r => r.addresses).filter(a => (a.street || '').length > 0)
    };

    // Trust Gemini's results - Only use best-guess logic if fields are empty
    const allCompanies = results.map(r => r.companyName).filter(c => c);
    mergedData.companyName = allCompanies.find(c => /Ltd|Limited|Pvt|Inc|Corp/i.test(c)) || allCompanies[0] || '';

    const allNames = results.map(r => r.contactPersonName).filter(n => n);
    const namePrefixes = ['Engr.', 'Md.', 'Mr.', 'Mrs.', 'Ms.', 'Dr.'];
    mergedData.contactPersonName = allNames.find(n => namePrefixes.some(p => n.includes(p))) || allNames[0] || '';

    const allDesigs = results.map(r => r.designation).filter(d => d);
    mergedData.designation = allDesigs[0] || '';

    // Final safety check for addresses array
    if (mergedData.addresses.length === 0) {
      mergedData.addresses = [{ street: '', area: '', city: '' }];
    }

    console.log('[DEBUG] Final Merged OCR Data:', JSON.stringify(mergedData, null, 2));

    res.json({ parsedData: mergedData, rotatedImages });
  } catch (error) { 
    console.error('OCR Endpoint Error:', error);
    res.status(500).json({ message: `OCR failed: ${error.message}` }); 
  }
});

// @desc    Get all leads (Role based)
router.get('/', protect, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'Employee') query.enteredBy = req.user._id;
    const leads = await Lead.find(query)
      .populate('enteredBy', 'name phone')
      .populate('shares.sharedWith', 'name role')
      .populate('shares.sharedBy', 'name phone')
      .sort('-createdAt');
    res.json(leads);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

// @desc    Get leads shared with user
router.get('/shared', protect, async (req, res) => {
  try {
    const leads = await Lead.find({ 'shares.sharedWith': req.user._id })
      .populate('enteredBy', 'name phone')
      .populate('shares.sharedWith', 'name role')
      .populate('shares.sharedBy', 'name phone')
      .sort('-createdAt');
    res.json(leads);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

// @desc    Create lead
router.post('/', protect, upload.fields([{ name: 'visitingCardFront', maxCount: 1 }, { name: 'visitingCardBack', maxCount: 1 }, { name: 'attachment', maxCount: 1 }]), async (req, res) => {
  try {
    let leadData = { ...req.body, enteredBy: req.user._id, phoneNumbers: JSON.parse(req.body.phoneNumbers || '[]'), emails: JSON.parse(req.body.emails || '[]'), addresses: JSON.parse(req.body.addresses || '[]') };
    if (req.files.visitingCardFront) leadData.visitingCardFront = await uploadToDrive(req.files.visitingCardFront[0].buffer, `CardFront_${Date.now()}`, req.files.visitingCardFront[0].mimetype);
    if (req.files.visitingCardBack) leadData.visitingCardBack = await uploadToDrive(req.files.visitingCardBack[0].buffer, `CardBack_${Date.now()}`, req.files.visitingCardBack[0].mimetype);
    if (req.files.attachment) leadData.attachment = await uploadToDrive(req.files.attachment[0].buffer, `Attach_${Date.now()}`, req.files.attachment[0].mimetype);
    const lead = await Lead.create(leadData);
    res.status(201).json(lead);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

// @desc    Update a lead (Universal Multi-format Fix)
router.put('/:id', protect, upload.single('attachment'), async (req, res) => {
  try {
    console.log("--- STARTING UPDATE PROCESS ---");
    console.log("Lead ID:", req.params.id);
    
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    
    const body = req.body;
    const updateData = {};
    
    console.log("DEBUG: Full req.body received:", JSON.stringify(body, null, 2));

    // 1. Map all text fields from req.body
    const textFields = [
      'companyName', 'contactPersonName', 'designation', 'industry', 
      'leadCategory', 'status', 'requirementInfo', 'comments', 
      'personalComments', 'primaryPhoneNumber'
    ];

    textFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    // 2. Explicit Numeric Conversion
    if (body.projectValue !== undefined) {
      const val = Number(body.projectValue);
      updateData.projectValue = isNaN(val) ? 0 : val;
    }

    // 3. Robust JSON Parsing for Arrays (Always check if it's already an array or a string)
    const arrayFields = ['phoneNumbers', 'emails', 'addresses', 'followUps'];
    arrayFields.forEach(field => {
      if (body[field]) {
        try {
          if (typeof body[field] === 'string') {
            updateData[field] = JSON.parse(body[field]);
          } else {
            updateData[field] = body[field];
          }
        } catch (e) {
          console.error(`Failed to parse field [${field}]:`, body[field]);
          // Fallback: if it's already an object/array, Mongoose will handle it
        }
      }
    });

    // 4. Handle enteredBy safely
    if (body.enteredBy) {
      if (typeof body.enteredBy === 'string' && body.enteredBy.includes('{')) {
        try {
          const eb = JSON.parse(body.enteredBy);
          updateData.enteredBy = eb._id || eb;
        } catch(e) { updateData.enteredBy = body.enteredBy; }
      } else {
        updateData.enteredBy = body.enteredBy;
      }
    }

    // 5. Handle File Upload
    if (req.file) {
      console.log("New attachment detected, uploading to Drive...");
      updateData.attachment = await uploadToDrive(req.file.buffer, `Attachment_${Date.now()}`, req.file.mimetype);
    }
    
    console.log("Final data to be saved to DB:", JSON.stringify(updateData, null, 2));

    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id, 
      { $set: updateData }, 
      { new: true, runValidators: true }
    ).populate('enteredBy', 'name phone').populate('shares.sharedWith', 'name role');

    if (!updatedLead) throw new Error("Database update failed to return document");

    console.log("Update Success! Follow-ups count:", updatedLead.followUps?.length);

    // Sales Complete Notif
    if (updatedLead.status === 'Sales Complete' && lead.status !== 'Sales Complete') {
       try {
         const creator = await User.findById(updatedLead.enteredBy);
         const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
         const monthLeads = await Lead.find({ enteredBy: updatedLead.enteredBy, status: 'Sales Complete', updatedAt: { $gte: monthStart } });
         const totalSales = monthLeads.reduce((sum, l) => sum + (l.projectValue || 0), 0);
         await sendPushNotification(updatedLead.enteredBy, {
           title: '🎉 Sales Complete!',
           body: `You closed ${updatedLead.companyName}. Monthly: ৳${totalSales.toLocaleString()}`,
           data: { url: '/dashboard' }
         });
       } catch (e) {}
    }

    res.json(updatedLead);
  } catch (error) {
    console.error("CRITICAL UPDATE ERROR:", error);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Share a lead
router.post('/:id/share', protect, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    const { userIds } = req.body;
    userIds.forEach(uId => { if (!lead.shares.some(s => s.sharedWith.toString() === uId)) lead.shares.push({ sharedWith: uId, sharedBy: req.user._id }); });
    await lead.save();
    for (const uId of userIds) { await sendPushNotification(uId, { title: 'New Lead Shared', body: `${req.user.name} shared ${lead.companyName} with you.`, data: { url: '/shared-leads' } }); }
    res.json(lead);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// @desc    Bulk share leads
router.post('/bulk-share', protect, async (req, res) => {
  try {
    const { leadIds, userIds } = req.body;
    if (!leadIds?.length || !userIds?.length) return res.status(400).json({ message: 'Missing lead or user IDs' });

    const leads = await Lead.find({ _id: { $in: leadIds } });
    
    for (const lead of leads) {
      userIds.forEach(uId => {
        if (!lead.shares.some(s => s.sharedWith.toString() === uId)) {
          lead.shares.push({ sharedWith: uId, sharedBy: req.user._id });
        }
      });
      await lead.save();
      
      // Notify each user
      for (const uId of userIds) {
        await sendPushNotification(uId, {
          title: 'New Leads Shared',
          body: `${req.user.name} shared ${leads.length} leads with you.`,
          data: { url: '/shared-leads' }
        });
      }
    }
    
    res.json({ message: `Successfully shared ${leads.length} leads with ${userIds.length} users` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Revoke shared access
router.delete('/:id/share/:userId', protect, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    lead.shares = lead.shares.filter(s => s.sharedWith.toString() !== req.params.userId);
    await lead.save();
    const updated = await Lead.findById(req.params.id).populate('enteredBy', 'name phone').populate('shares.sharedWith', 'name role');
    res.json(updated);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// @desc    Delete
router.delete('/:id', protect, async (req, res) => {
  try {
    if (!['Admin', 'Owner', 'Manager'].includes(req.user.role)) return res.status(403).json({ message: 'Unauthorized' });
    await Lead.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// @desc    Get dashboard stats
router.get('/dashboard-stats', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const leads = await Lead.find({
      enteredBy: userId,
      status: 'Closed', // Assuming 'Closed' means Sales Complete
      updatedAt: { $gte: monthStart }
    });

    const completed = leads.reduce((sum, lead) => sum + (lead.projectValue || 0), 0);
    const totalLeads = await Lead.countDocuments({ enteredBy: userId });

    res.json({
      totalLeads,
      target: user.monthlyTarget || 0,
      completed
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get upcoming follow-ups
router.get('/upcoming-followups', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));

    const leads = await Lead.find({
      enteredBy: userId,
      'followUps.date': { $gte: startOfToday }
    }).select('companyName followUps');

    const followUps = leads.flatMap(lead => 
      lead.followUps
        .filter(f => new Date(f.date) >= startOfToday)
        .map(f => ({
          companyName: lead.companyName,
          date: f.date,
          note: f.note
        }))
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    res.json(followUps.slice(0, 5)); // Return top 5
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = { router };
