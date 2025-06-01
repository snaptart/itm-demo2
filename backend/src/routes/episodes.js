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

// Admin-only routes
router.post('/', authorizeAdmin, episodeController.createEpisode);
router.put('/:id', authorizeAdmin, episodeController.updateEpisode);
router.delete('/:id', authorizeAdmin, episodeController.deleteEpisode);

module.exports = router;