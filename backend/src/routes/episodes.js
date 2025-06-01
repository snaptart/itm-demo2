// backend/src/routes/episodes.js (Enhanced with Drag-Drop routes)
const express = require('express');
const router = express.Router();
const episodeController = require('../controllers/episodeController');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Get episodes for calendar view (available to all authenticated users)
router.get('/', episodeController.getEpisodes);

// Get calendar resources (facilities and rinks)
router.get('/resources', episodeController.getCalendarResources);

// Get single episode details
router.get('/:id', episodeController.getEpisodeById);

// Drag and Drop validation endpoints (Admin only)
router.post('/validate-move', authorizeAdmin, episodeController.validateEpisodeMove);
router.post('/validate-batch-moves', authorizeAdmin, episodeController.validateBatchMoves);

// Drag and Drop action endpoints (Admin only)
router.put('/:id/move', authorizeAdmin, episodeController.moveEpisode);
router.put('/:id/resize', authorizeAdmin, episodeController.resizeEpisode);

// Standard CRUD endpoints (Admin only)
router.post('/', authorizeAdmin, episodeController.createEpisode);
router.put('/:id', authorizeAdmin, episodeController.updateEpisode);
router.delete('/:id', authorizeAdmin, episodeController.deleteEpisode);

module.exports = router;