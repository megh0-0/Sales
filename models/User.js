const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true }, // Login ID
  email: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
  designation: { type: String, trim: true },
  role: {
    type: String,
    enum: ['Employee', 'Manager', 'Admin', 'Owner'],
    default: 'Employee',
  },
  managers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Plural: Assign Managers
  password: { type: String, required: true, select: false },
  joiningDate: { type: Date, default: null },
  resignationDate: { type: Date, default: null },
  visitingCard: { type: String, default: null }, // URL to the user's own visiting card image
  monthlyTarget: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
