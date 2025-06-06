const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

// All routes require authentication and admin access
router.use(authenticateToken);
router.use(authorizeAdmin);

// Create new event
router.post('/', eventController.createEvent);

// Get events by resource
router.get('/resource/:resourceId', eventController.getEventsByResource);

// Delete event
router.delete('/:id', eventController.deleteEvent);

module.exports = router;