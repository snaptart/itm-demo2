// backend/src/routes/events.js - Updated with Real-time Middleware
const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
const realtimeMiddleware = require('../middleware/realtimeMiddleware');

// All routes require authentication and admin access
router.use(authenticateToken);
router.use(authorizeAdmin);

// Add request logging middleware for debugging
router.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - Event Route: ${req.method} ${req.originalUrl}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Request body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Create new event - WITH REAL-TIME MIDDLEWARE
router.post('/', 
  realtimeMiddleware.episodeOperations('create'),
  eventController.createEvent
);

// Get events by resource
router.get('/resource/:resourceId', eventController.getEventsByResource);

// Delete event - WITH REAL-TIME MIDDLEWARE
router.delete('/:id', 
  realtimeMiddleware.episodeOperations('delete'),
  eventController.deleteEvent
);

module.exports = router;