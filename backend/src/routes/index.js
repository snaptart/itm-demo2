const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const facilityRoutes = require('./facilities');
const resourceRoutes = require('./resources');
// Future routes to be added
// const userRoutes = require('./users');
// const episodeRoutes = require('./episodes');
// const bookingRoutes = require('./bookings');
// const programRoutes = require('./programs');
// const notificationRoutes = require('./notifications');

// Mount routes
router.use('/auth', authRoutes);
router.use('/facilities', facilityRoutes);
router.use('/resources', resourceRoutes);
// Future routes
// router.use('/users', userRoutes);
// router.use('/episodes', episodeRoutes);
// router.use('/bookings', bookingRoutes);
// router.use('/programs', programRoutes);
// router.use('/notifications', notificationRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;