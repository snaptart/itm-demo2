// backend/src/routes/adminRequests.js
const express = require('express');
const router = express.Router();
const adminRequestController = require('../controllers/adminRequestController');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

// All routes require authentication and admin access
router.use(authenticateToken);
router.use(authorizeAdmin);

// Add request logging middleware for debugging
router.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - Admin Request Route: ${req.method} ${req.originalUrl}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Request body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// =============================================
// REQUEST QUEUE MANAGEMENT ROUTES
// =============================================

// GET /api/admin/requests - Get request queue with filtering and pagination
router.get('/', adminRequestController.getRequestQueue);

// GET /api/admin/requests/:request_id - Get detailed request information
router.get('/:request_id', adminRequestController.getRequestDetails);

// =============================================
// REQUEST APPROVAL/REJECTION ROUTES
// =============================================

// PUT /api/admin/requests/:request_id/approve - Approve a single request
router.put('/:request_id/approve', adminRequestController.approveRequest);

// PUT /api/admin/requests/:request_id/reject - Reject a single request
router.put('/:request_id/reject', adminRequestController.rejectRequest);

// POST /api/admin/requests/batch - Batch approve/reject multiple requests
router.post('/batch', adminRequestController.batchProcessRequests);

// =============================================
// DASHBOARD & ANALYTICS ROUTES
// =============================================

// GET /api/admin/requests/dashboard/metrics - Get admin dashboard metrics
router.get('/dashboard/metrics', adminRequestController.getDashboardMetrics);

// Error handling middleware specific to admin request routes
router.use((error, req, res, next) => {
  console.error('Admin Request route error:', error);
  
  // Handle specific error types
  if (error.name === 'SequelizeValidationError') {
    return res.status(400).json({
      message: 'Validation error',
      errors: error.errors.map(e => ({
        field: e.path,
        message: e.message
      }))
    });
  }
  
  if (error.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({
      message: 'Invalid reference to related data'
    });
  }
  
  if (error.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      message: 'Duplicate entry',
      field: error.errors[0]?.path
    });
  }
  
  res.status(500).json({
    message: 'An error occurred processing the admin request',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
});

module.exports = router;