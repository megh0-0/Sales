const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const NotificationSubscription = require('../models/NotificationSubscription');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

// @desc    Save a push subscription
router.post('/subscribe', protect, async (req, res) => {
  try {
    const subscription = req.body;
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

// @desc    Get user notifications
router.get('/', protect, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get unread notification count
router.get('/unread-count', protect, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ user: req.user._id, isRead: false });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Mark a notification as read
router.put('/:id/read', protect, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isRead: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Mark all notifications as read
router.put('/read-all', protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { isRead: true }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Utility to send notification
const sendPushNotification = async (userId, payload) => {
  try {
    // 1. Save notification to DB for the dropdown history
    await Notification.create({
      user: userId,
      title: payload.title || 'New Notification',
      body: payload.body || '',
      url: payload.data?.url || '/'
    });

    // 2. Send via Web Push
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
  } catch (error) {
    console.error('Push notification error:', error);
  }
};

module.exports = { router, sendPushNotification };
