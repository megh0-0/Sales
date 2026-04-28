require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const webpush = require('web-push');
const cron = require('node-cron');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const industryRoutes = require('./routes/industryRoutes');
const { router: leadRoutes } = require('./routes/leadRoutes');
const supplementRoutes = require('./routes/supplementRoutes');
const { router: notificationRoutes, sendPushNotification } = require('./routes/notificationRoutes');
const Lead = require('./models/Lead');

const app = express();

// web-push config
webpush.setVapidDetails(
  'mailto:support@theaircons.com',
  process.env.VAPID_PUBLIC_KEY || 'BFMMhZGsNyK90xB2kAhAqn_y5NDD1O806MClD-9ga5MS_xJlkkl3TgR4y7O85LQ4oJ2GG7yh6FmoR-vAuhWe5wk',
  process.env.VAPID_PRIVATE_KEY || '95VEJz3YcsemlelAgI-hCPlxSo1BDpQ5K4vykyOhdbc'
);

// Middleware
app.use(morgan('dev'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/api', (req, res) => {
  res.json({ message: 'Welcome to the Sales App API', version: '1.0.0' });
});
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/industries', industryRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/supplements', supplementRoutes);
app.use('/api/notifications', notificationRoutes);

// Cron Job for Follow-up Reminders (Check every hour)
cron.schedule('0 * * * *', async () => {
  console.log('Running Follow-up Reminder Job...');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const startOfTomorrow = new Date(tomorrow.setHours(0, 0, 0, 0));
  const endOfTomorrow = new Date(tomorrow.setHours(23, 59, 59, 999));

  try {
    const leads = await Lead.find({
      'followUps.date': { $gte: startOfTomorrow, $lte: endOfTomorrow }
    }).populate('enteredBy');

    for (const lead of leads) {
      const followUp = lead.followUps.find(f => f.date >= startOfTomorrow && f.date <= endOfTomorrow);
      await sendPushNotification(lead.enteredBy._id, {
        title: 'Upcoming Follow-up Tomorrow!',
        body: `Lead: ${lead.companyName} at ${followUp.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        data: { url: '/data-bank' }
      });
    }
  } catch (err) {
    console.error('Reminder job failed:', err);
  }
});

// Health check
app.get('/', (req, res) => {
  res.send('Sales App API is running...');
});

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sales-app';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
