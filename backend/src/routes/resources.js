const express = require('express');
const router = express.Router();
const resourceController = require('../controllers/resourceController');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Get all resource types
router.get('/types', resourceController.getResourceTypes);

// Get resources by facility
router.get('/facility/:facilityId', resourceController.getResourcesByFacility);

// Get single resource by ID
router.get('/:id', resourceController.getResourceById);

// Admin-only routes
router.post('/', authorizeAdmin, resourceController.createResource);
router.put('/:id', authorizeAdmin, resourceController.updateResource);
router.patch('/:id/status', authorizeAdmin, resourceController.toggleResourceStatus);
router.delete('/:id', authorizeAdmin, resourceController.deleteResource);

module.exports = router;