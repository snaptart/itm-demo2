// backend/src/routes/episodes.js (Fixed for Phase 3B)
const express = require('express');
const router = express.Router();
const episodeController = require('../controllers/episodeController');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

// Add request logging middleware for debugging
router.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
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

// Drag and Drop action endpoints (Admin only) - FIXED ORDER
router.put('/:id/move', authorizeAdmin, (req, res, next) => {
  console.log(`Route matched: PUT /:id/move with id=${req.params.id}`);
  episodeController.moveEpisode(req, res, next);
});

router.put('/:id/resize', authorizeAdmin, (req, res, next) => {
  console.log(`Route matched: PUT /:id/resize with id=${req.params.id}`);
  episodeController.resizeEpisode(req, res, next);
});

// Standard CRUD endpoints (Admin only)
router.post('/', authorizeAdmin, episodeController.createEpisode);
router.put('/:id', authorizeAdmin, episodeController.updateEpisode);
router.delete('/:id', authorizeAdmin, episodeController.deleteEpisode);

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Episode route error:', error);
  res.status(500).json({
    message: 'An error occurred processing the request',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
});

module.exports = router;