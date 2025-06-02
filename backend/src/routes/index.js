// backend/src/routes/index.js - Updated version
const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const facilityRoutes = require('./facilities');
const resourceRoutes = require('./resources');
const episodeRoutes = require('./episodes');
const eventRoutes = require('./events');
const programRoutes = require('./programs'); // Added
// Future routes to be added
// const userRoutes = require('./users');
// const bookingRoutes = require('./bookings');
// const notificationRoutes = require('./notifications');

// Mount routes
router.use('/auth', authRoutes);
router.use('/facilities', facilityRoutes);
router.use('/resources', resourceRoutes);
router.use('/episodes', episodeRoutes);
router.use('/events', eventRoutes);
router.use('/programs', programRoutes); // Added
// Future routes
// router.use('/users', userRoutes);
// router.use('/bookings', bookingRoutes);
// router.use('/notifications', notificationRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;