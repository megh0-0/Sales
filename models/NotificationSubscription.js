const mongoose = require('mongoose');

const notificationSubscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subscription: {
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true }
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('NotificationSubscription', notificationSubscriptionSchema);
