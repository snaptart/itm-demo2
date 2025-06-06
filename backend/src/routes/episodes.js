// backend/src/routes/episodes.js - Updated with Real-time Middleware
const express = require('express');
const router = express.Router();
const episodeController = require('../controllers/episodeController');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
const realtimeMiddleware = require('../middleware/realtimeMiddleware');

// Add request logging middleware for debugging
router.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - Episode Route: ${req.method} ${req.originalUrl}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Request body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// All routes require authentication
router.use(authenticateToken);

// Public routes (available to all authenticated users)
// Get episodes for calendar view
router.get('/', episodeController.getEpisodes);

// Get calendar resources (facilities and rinks)
router.get('/resources', episodeController.getCalendarResources);

// Get single episode details
router.get('/:id', episodeController.getEpisodeById);

// Admin-only routes for drag and drop operations
// IMPORTANT: Put specific routes BEFORE parameterized routes to avoid conflicts

// Validation endpoints (Admin only)
router.post('/validate-move', authorizeAdmin, episodeController.validateEpisodeMove);
router.post('/validate-batch-moves', authorizeAdmin, episodeController.validateBatchMoves);

// Drag and Drop action endpoints (Admin only) - WITH REAL-TIME MIDDLEWARE
router.put('/:id/move', 
  authorizeAdmin, 
  realtimeMiddleware.checkEpisodeLock,
  realtimeMiddleware.episodeOperations('move'),
  (req, res, next) => {
    console.log(`Route matched: PUT /:id/move with id=${req.params.id}`);
    episodeController.moveEpisode(req, res, next);
  }
);

router.put('/:id/resize', 
  authorizeAdmin, 
  realtimeMiddleware.checkEpisodeLock,
  realtimeMiddleware.episodeOperations('resize'),
  (req, res, next) => {
    console.log(`Route matched: PUT /:id/resize with id=${req.params.id}`);
    episodeController.resizeEpisode(req, res, next);
  }
);

// Standard CRUD endpoints (Admin only) - WITH REAL-TIME MIDDLEWARE
router.post('/', 
  authorizeAdmin, 
  realtimeMiddleware.episodeOperations('create'),
  episodeController.createEpisode
);

router.put('/:id', 
  authorizeAdmin, 
  realtimeMiddleware.checkEpisodeLock,
  realtimeMiddleware.episodeOperations('update'),
  episodeController.updateEpisode
);

router.delete('/:id', 
  authorizeAdmin, 
  realtimeMiddleware.checkEpisodeLock,
  realtimeMiddleware.episodeOperations('delete'),
  episodeController.deleteEpisode
);

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Episode route error:', error);
  res.status(500).json({
    message: 'An error occurred processing the request',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
});

module.exports = router;