// backend/src/routes/index.js - Updated with Admin Request Routes
const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const facilityRoutes = require('./facilities');
const resourceRoutes = require('./resources');
const episodeRoutes = require('./episodes');
const eventRoutes = require('./events');
const programRoutes = require('./programs');

// NEW: Admin and scheduler specific routes
const adminRequestRoutes = require('./adminRequests');
const schedulerRoutes = require('./scheduler');

// Future routes to be added
// const userRoutes = require('./users');
// const bookingRoutes = require('./bookings');
// const notificationRoutes = require('./notifications');
// const websocketRoutes = require('./websocket');

// Mount existing routes
router.use('/auth', authRoutes);
router.use('/facilities', facilityRoutes);
router.use('/resources', resourceRoutes);
router.use('/episodes', episodeRoutes);
router.use('/events', eventRoutes);
router.use('/programs', programRoutes);

// Mount new admin and scheduler routes
router.use('/admin/requests', adminRequestRoutes);
router.use('/scheduler', schedulerRoutes);

// Future routes
// router.use('/users', userRoutes);
// router.use('/bookings', bookingRoutes);
// router.use('/notifications', notificationRoutes);
// router.use('/websocket', websocketRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      auth: 'active',
      realtime: 'available'
    }
  });
});

// API documentation endpoint
router.get('/docs', (req, res) => {
  res.json({
    message: 'Ice Time Management API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      facilities: '/api/facilities',
      resources: '/api/resources',
      episodes: '/api/episodes',
      events: '/api/events',
      programs: '/api/programs',
      admin_requests: '/api/admin/requests',
      scheduler: '/api/scheduler'
    },
    documentation: 'https://docs.yourdomain.com/api'
  });
});

module.exports = router;