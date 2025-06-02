// backend/src/routes/programs.js
const express = require('express');
const router = express.Router();
const programController = require('../controllers/programController');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Get all programs (for dropdown lists)
router.get('/', programController.getPrograms);

// Get single program
router.get('/:id', programController.getProgramById);

// Admin-only routes
router.post('/', authorizeAdmin, programController.createProgram);
router.put('/:id', authorizeAdmin, programController.updateProgram);
router.delete('/:id', authorizeAdmin, programController.deleteProgram);

module.exports = router;