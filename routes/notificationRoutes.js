const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const NotificationSubscription = require('../models/NotificationSubscription');
const { protect } = require('../middleware/auth');

// @desc    Save a push subscription
router.post('/subscribe', protect, async (req, res) => {
  try {
    const subscription = req.body;
    // Update if exists, else create
    await NotificationSubscription.findOneAndUpdate(
      { user: req.user._id, 'subscription.endpoint': subscription.endpoint },
      { user: req.user._id, subscription },
      { upsert: true, new: true }
    );
    res.status(201).json({ message: 'Subscribed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Utility to send notification
const sendPushNotification = async (userId, payload) => {
  const subscriptions = await NotificationSubscription.find({ user: userId });
  const results = await Promise.allSettled(subscriptions.map(sub => 
    webpush.sendNotification(sub.subscription, JSON.stringify(payload))
      .catch(err => {
        if (err.statusCode === 410) { // Subscription expired or removed
           return NotificationSubscription.deleteOne({ _id: sub._id });
        }
        throw err;
      })
  ));
  return results;
};

module.exports = { router, sendPushNotification };
