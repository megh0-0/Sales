const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  // 1. Lead Details
  companyName: { type: String, required: true, trim: true },
  contactPersonName: { type: String, required: true, trim: true },
  designation: { type: String, trim: true },
  phoneNumbers: [{ type: String, trim: true }], // Multiple can be entered
  primaryPhoneNumber: { type: String, trim: true },
  emails: [{ type: String, trim: true, lowercase: true }], // Multiple can be entered
  addresses: [{
    street: { type: String, trim: true },
    area: { type: String, trim: true },
    city: { type: String, trim: true }
  }], // Multiple addresses with area and city
  industry: { type: String, trim: true }, // Dropdown - managed from settings
  visitingCardFront: { type: String }, // Image URL
  visitingCardBack: { type: String }, // Image URL
  leadCategory: {
    type: String,
    enum: ['New Lead', 'Existing Lead', 'Collected'],
    required: true
  },
  status: {
    type: String,
    enum: ['Lead generated', 'Potential', 'Quotation submitted', 'On going negotiation', 'Sales Complete'],
    default: 'Lead generated'
  },

  // 2. Requirement Information (Optional)
  requirementInfo: { type: String, trim: true },
  projectValue: { type: Number, default: 0 },
  attachment: { type: String }, // File URL

  // 3. Lead's Comments (Optional)
  comments: { type: String, trim: true },
  personalComments: { type: String, trim: true },

  // Tracking
  followUps: [{
    date: { type: Date, required: true },
    note: { type: String, trim: true }
  }],
  enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  shares: [{
    sharedWith: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sharedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sharedAt: { type: Date, default: Date.now }
  }],
}, { timestamps: true });

// Serialized and sorted by entried date is handled by Mongoose timestamps 'createdAt'

module.exports = mongoose.model('Lead', leadSchema);
