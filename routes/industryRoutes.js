const express = require('express');
const router = express.Router();
const Industry = require('../models/Industry');
const { protect, authorize } = require('../middleware/auth');

// @desc    Get all industry names
// @route   GET /api/industries
router.get('/', protect, async (req, res) => {
  try {
    const industries = await Industry.find({}).sort('name');
    res.json(industries);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Add a new industry
// @route   POST /api/industries
router.post('/', protect, authorize('Admin', 'Owner'), async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Industry name is required' });

  try {
    const industry = await Industry.create({ name });
    res.status(201).json(industry);
  } catch (error) {
    res.status(400).json({ message: 'Industry already exists or error occurred' });
  }
});

// @desc    Delete an industry
// @route   DELETE /api/industries/:id
router.delete('/:id', protect, authorize('Admin', 'Owner'), async (req, res) => {
  try {
    const industry = await Industry.findByIdAndDelete(req.params.id);
    if (!industry) return res.status(404).json({ message: 'Industry not found' });
    res.json({ message: 'Industry removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
