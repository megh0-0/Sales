require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const createAdmin = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sales-app';
    await mongoose.connect(MONGODB_URI);

    const adminPhone = '1234567890'; // Default admin phone
    const adminExists = await User.findOne({ phone: adminPhone });

    if (adminExists) {
      console.log('Admin user already exists');
      process.exit();
    }

    const admin = await User.create({
      name: 'Global Admin',
      phone: adminPhone,
      password: 'adminpassword', // Will be hashed by pre-save hook
      role: 'Admin',
      isActive: true,
    });

    console.log('Admin user created successfully');
    console.log('Phone:', adminPhone);
    console.log('Password: adminpassword');
    process.exit();
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  }
};

createAdmin();
