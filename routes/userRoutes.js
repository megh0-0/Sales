const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { uploadToDrive } = require('../utils/googleDrive');

// @desc    Get all users
// @route   GET /api/users
router.get('/', protect, authorize('Admin', 'Owner', 'Manager'), async (req, res) => {
  try {
    const users = await User.find({}).populate('managers', 'name phone');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Create a new user
// @route   POST /api/users
router.post('/', protect, authorize('Admin', 'Owner'), upload.single('visitingCard'), async (req, res) => {
  const { name, phone, email, designation, role, password, joiningDate, monthlyTarget } = req.body;
  let { managers, isActive } = req.body;

  try {
    const userExists = await User.findOne({ phone });
    if (userExists) {
      return res.status(400).json({ message: 'User with this phone number already exists' });
    }

    // Handle FormData string conversions
    if (typeof managers === 'string') {
      try { managers = JSON.parse(managers); } catch (e) { managers = []; }
    }
    isActive = isActive === 'false' ? false : true;

    let visitingCardUrl = null;
    if (req.file) {
      visitingCardUrl = await uploadToDrive(req.file.buffer, `VC_${name}_${phone}.jpg`, req.file.mimetype);
    }

    const user = await User.create({
      name,
      phone,
      email,
      designation,
      role,
      managers: Array.isArray(managers) ? managers : [],
      password,
      joiningDate,
      visitingCard: visitingCardUrl,
      monthlyTarget: monthlyTarget || 0,
      isActive,
    });

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update a user
// @route   PUT /api/users/:id
router.put('/:id', protect, authorize('Admin', 'Owner'), upload.single('visitingCard'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (user) {
      user.name = req.body.name || user.name;
      user.phone = req.body.phone || user.phone;
      user.email = req.body.email || user.email;
      user.designation = req.body.designation || user.designation;
      user.role = req.body.role || user.role;
      user.joiningDate = req.body.joiningDate || user.joiningDate;
      user.resignationDate = req.body.resignationDate || user.resignationDate;
      user.monthlyTarget = req.body.monthlyTarget !== undefined ? req.body.monthlyTarget : user.monthlyTarget;

      if (req.body.isActive !== undefined) {
        user.isActive = req.body.isActive === 'false' ? false : true;
      }

      if (req.body.managers) {
        try {
          user.managers = typeof req.body.managers === 'string' ? JSON.parse(req.body.managers) : req.body.managers;
        } catch (e) { /* keep existing */ }
      }

      if (req.file) {
        user.visitingCard = await uploadToDrive(req.file.buffer, `VC_${user.name}_${user.phone}.jpg`, req.file.mimetype);
      } else if (req.body.visitingCard === 'null') {
        user.visitingCard = null;
      }

      if (req.body.password) {
        user.password = req.body.password;
      }

      const updatedUser = await user.save();
      res.json(updatedUser);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
