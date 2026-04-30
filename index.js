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

// Cron Job for Follow-up Reminders (Check every 15 minutes)
cron.schedule('*/15 * * * *', async () => {
  console.log('Running Advanced Follow-up Reminder Job...');
  const now = new Date();
  
  // 1 Day Before range (24h to 24h15m)
  const oneDayOutStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const oneDayOutEnd = new Date(oneDayOutStart.getTime() + 15 * 60 * 1000);

  // 3 Hours Before range (3h to 3h15m)
  const threeHoursOutStart = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const threeHoursOutEnd = new Date(threeHoursOutStart.getTime() + 15 * 60 * 1000);

  try {
    const leads = await Lead.find({
      'followUps.date': { 
        $or: [
          { $gte: oneDayOutStart, $lt: oneDayOutEnd },
          { $gte: threeHoursOutStart, $lt: threeHoursOutEnd }
        ]
      }
    }).populate('enteredBy');

    for (const lead of leads) {
      const upcoming = lead.followUps.find(f => {
        const d = new Date(f.date);
        return (d >= oneDayOutStart && d < oneDayOutEnd) || (d >= threeHoursOutStart && d < threeHoursOutEnd);
      });

      if (upcoming && lead.enteredBy) {
        const timeLabel = (new Date(upcoming.date) >= oneDayOutStart) ? '1 day' : '3 hours';
        await sendPushNotification(lead.enteredBy._id, {
          title: `⏰ Follow-up in ${timeLabel}`,
          body: `Upcoming schedule with ${lead.companyName}: ${upcoming.note?.substring(0, 50) || 'No notes'}`,
          data: { url: '/data-bank' }
        });
      }
    }
  } catch (err) {
    console.error('Reminder job failed:', err);
  }
});

// Cron Job for End of Month Sales Target Check (Runs at 11:50 PM on the last day of the month)
cron.schedule('50 23 28-31 * *', async () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (tomorrow.getDate() !== 1) return; // Only run on the actual last day

  console.log('Running End of Month Target Check...');
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  try {
    const users = await User.find({ isActive: true, monthlyTarget: { $gt: 0 } });
    for (const user of users) {
      const monthLeads = await Lead.find({ 
        enteredBy: user._id, 
        status: 'Sales Complete', 
        updatedAt: { $gte: monthStart } 
      });
      const totalSales = monthLeads.reduce((sum, l) => sum + (l.projectValue || 0), 0);

      if (totalSales < user.monthlyTarget) {
        await sendPushNotification(user._id, {
          title: '📉 Target Not Reached',
          body: `Month ended. You achieved ৳${totalSales.toLocaleString()} of your ৳${user.monthlyTarget.toLocaleString()} target.`,
          data: { url: '/dashboard' }
        });
      }
    }
  } catch (error) {
    console.error('Monthly Cron Error:', error);
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
