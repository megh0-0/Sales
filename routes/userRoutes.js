const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

// @desc    Get all users
// @route   GET /api/users
router.get('/', protect, authorize('Admin', 'Owner'), async (req, res) => {
  try {
    const users = await User.find({}).populate('managers', 'name phone');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Create a new user
// @route   POST /api/users
router.post('/', protect, authorize('Admin', 'Owner'), async (req, res) => {
  const { name, phone, email, designation, role, managers, password, joiningDate, isActive } = req.body;

  try {
    const userExists = await User.findOne({ phone });
    if (userExists) {
      return res.status(400).json({ message: 'User with this phone number already exists' });
    }

    const user = await User.create({
      name,
      phone,
      email,
      designation,
      role,
      managers,
      password,
      joiningDate,
      isActive: isActive !== undefined ? isActive : true,
    });

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update a user
// @route   PUT /api/users/:id
router.put('/:id', protect, authorize('Admin', 'Owner'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (user) {
      user.name = req.body.name || user.name;
      user.phone = req.body.phone || user.phone;
      user.email = req.body.email || user.email;
      user.designation = req.body.designation || user.designation;
      user.role = req.body.role || user.role;
      user.managers = req.body.managers || user.managers;
      user.joiningDate = req.body.joiningDate || user.joiningDate;
      user.resignationDate = req.body.resignationDate || user.resignationDate;
      user.isActive = req.body.isActive !== undefined ? req.body.isActive : user.isActive;

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
