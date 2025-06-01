const express = require('express');
const router = express.Router();
const facilityController = require('../controllers/facilityController');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Get all facilities (Admin and Scheduler can access)
router.get('/', facilityController.getAllFacilities);

// Get single facility by ID
router.get('/:id', facilityController.getFacilityById);

// Get facility statistics
router.get('/:id/stats', facilityController.getFacilityStats);

// Admin-only routes
router.post('/', authorizeAdmin, facilityController.createFacility);
router.put('/:id', authorizeAdmin, facilityController.updateFacility);
router.delete('/:id', authorizeAdmin, facilityController.deleteFacility);

module.exports = router;