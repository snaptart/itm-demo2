// backend/src/routes/scheduler.js
const express = require('express');
const router = express.Router();
const schedulerController = require('../controllers/schedulerController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Middleware to ensure user is a scheduler or admin
const authorizeScheduler = (req, res, next) => {
  if (!['scheduler', 'admin'].includes(req.user.user_type)) {
    return res.status(403).json({ 
      message: 'Access denied. Scheduler or admin privileges required.' 
    });
  }
  next();
};

router.use(authorizeScheduler);

// Add request logging middleware for debugging
router.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - Scheduler Route: ${req.method} ${req.originalUrl}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Request body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// =============================================
// SHOPPING CART ROUTES
// =============================================

// GET /api/scheduler/cart - Get user's shopping cart
router.get('/cart', schedulerController.getShoppingCart);

// POST /api/scheduler/cart - Add item to shopping cart
router.post('/cart', schedulerController.addToCart);

// DELETE /api/scheduler/cart/:cart_id - Remove item from shopping cart
router.delete('/cart/:cart_id', schedulerController.removeFromCart);

// DELETE /api/scheduler/cart - Clear entire shopping cart
router.delete('/cart', schedulerController.clearCart);

// PUT /api/scheduler/cart/sync - Sync cart across sessions
router.put('/cart/sync', schedulerController.syncCart);

// =============================================
// ICE TIME REQUEST ROUTES
// =============================================

// POST /api/scheduler/requests/submit - Submit shopping cart as requests
router.post('/requests/submit', schedulerController.submitCartRequests);

// GET /api/scheduler/requests - Get user's ice time requests
router.get('/requests', schedulerController.getMyRequests);

// PUT /api/scheduler/requests/:request_id/cancel - Cancel a pending request
router.put('/requests/:request_id/cancel', schedulerController.cancelRequest);

// =============================================
// EPISODE FILTERING & VIEWING ROUTES
// =============================================

// GET /api/scheduler/episodes - Get episodes filtered for scheduler view
router.get('/episodes', schedulerController.getFilteredEpisodes);

// =============================================
// ADDITIONAL SCHEDULER UTILITIES
// =============================================

// GET /api/scheduler/programs - Get user's programs (helper endpoint)
router.get('/programs', async (req, res) => {
  try {
    const { Program } = require('../models');
    const { Op } = require('sequelize');
    
    const programs = await Program.findAll({
      where: {
        [Op.or]: [
          { scheduler_user_id: req.user.user_id },
          { program_admin_user_id: req.user.user_id }
        ]
      },
      include: ['programType'],
      order: [['program_name', 'ASC']]
    });

    res.json({
      programs,
      total: programs.length
    });

  } catch (error) {
    console.error('Get user programs error:', error);
    res.status(500).json({ message: 'Error fetching programs' });
  }
});

// GET /api/scheduler/dashboard - Get scheduler dashboard summary
router.get('/dashboard', async (req, res) => {
  try {
    const { ShoppingCart, IceTimeRequest } = require('../models');
    const { user_id } = req.user;

    // Get cart summary
    const cartCount = await ShoppingCart.getUserCartCount(user_id);
    const cartTotal = await ShoppingCart.getUserCartTotal(user_id);

    // Get request summary
    const requestSummary = await IceTimeRequest.findAll({
      where: { user_id },
      attributes: [
        'request_status',
        [require('../config/database').fn('COUNT', require('../config/database').col('request_id')), 'count']
      ],
      group: ['request_status'],
      raw: true
    });

    const requestStats = requestSummary.reduce((acc, item) => {
      acc[item.request_status] = parseInt(item.count);
      return acc;
    }, {});

    // Get recent activity
    const recentRequests = await IceTimeRequest.findAll({
      where: { user_id },
      include: ['program', 'facility'],
      order: [['submitted_at', 'DESC']],
      limit: 5
    });

    res.json({
      cart_summary: {
        item_count: cartCount,
        total_cost: cartTotal.toFixed(2)
      },
      request_summary: {
        pending: requestStats.pending || 0,
        approved: requestStats.approved || 0,
        rejected: requestStats.rejected || 0,
        confirmed: requestStats.confirmed || 0,
        cancelled: requestStats.cancelled || 0,
        total: Object.values(requestStats).reduce((sum, count) => sum + count, 0)
      },
      recent_requests: recentRequests,
      user_info: {
        user_id: req.user.user_id,
        username: req.user.username,
        user_type: req.user.user_type,
        full_name: `${req.user.first_name} ${req.user.last_name}`
      }
    });

  } catch (error) {
    console.error('Get scheduler dashboard error:', error);
    res.status(500).json({ message: 'Error fetching dashboard data' });
  }
});

// GET /api/scheduler/facilities - Get facilities user has access to
router.get('/facilities', async (req, res) => {
  try {
    const { Facility, Program } = require('../models');
    const { Op } = require('sequelize');

    // Get user's programs to determine facility access
    const userPrograms = await Program.findAll({
      where: {
        [Op.or]: [
          { scheduler_user_id: req.user.user_id },
          { program_admin_user_id: req.user.user_id }
        ]
      }
    });

    // For now, return all facilities (this could be restricted based on business rules)
    const facilities = await Facility.findAll({
      attributes: [
        'facility_id', 
        'facility_name', 
        'facility_city', 
        'facility_state',
        'facility_time_zone'
      ],
      order: [['facility_name', 'ASC']]
    });

    res.json({
      facilities,
      user_programs: userPrograms.map(p => ({
        program_id: p.program_id,
        program_name: p.program_name,
        program_color: p.program_color
      }))
    });

  } catch (error) {
    console.error('Get facilities error:', error);
    res.status(500).json({ message: 'Error fetching facilities' });
  }
});

// POST /api/scheduler/cart/validate - Validate cart items before submission
router.post('/cart/validate', async (req, res) => {
  try {
    const { ShoppingCart, Episode } = require('../models');
    const { program_id } = req.body;
    const { user_id } = req.user;

    if (!program_id) {
      return res.status(400).json({ message: 'Program ID is required' });
    }

    // Get cart items for validation
    const cartItems = await ShoppingCart.findAll({
      where: { user_id, program_id },
      include: ['episode']
    });

    const validation = {
      valid_items: [],
      invalid_items: [],
      warnings: [],
      can_submit: true
    };

    for (const item of cartItems) {
      const episode = item.episode;
      const itemValidation = {
        cart_id: item.cart_id,
        episode_id: item.episode_id,
        episode_title: item.episode_title,
        issues: []
      };

      // Check if episode still exists and is available
      if (!episode) {
        itemValidation.issues.push('Episode no longer exists');
        validation.invalid_items.push(itemValidation);
        continue;
      }

      // Check episode status
      if (!['available', 'assigned'].includes(episode.episode_status)) {
        itemValidation.issues.push(`Episode status is now: ${episode.episode_status}`);
        validation.invalid_items.push(itemValidation);
        continue;
      }

      // Check if episode is in the past
      if (new Date(item.episode_start_date_time) < new Date()) {
        itemValidation.issues.push('Episode is in the past');
        validation.invalid_items.push(itemValidation);
        continue;
      }

      // Check for potential conflicts (other pending requests)
      const conflictingRequests = await require('../models').IceTimeRequest.count({
        where: {
          episode_id: item.episode_id,
          request_status: 'pending'
        }
      });

      if (conflictingRequests > 0) {
        validation.warnings.push({
          cart_id: item.cart_id,
          episode_title: item.episode_title,
          message: `${conflictingRequests} other pending request(s) for this ice time`
        });
      }

      validation.valid_items.push(itemValidation);
    }

    // Determine if submission is possible
    validation.can_submit = validation.invalid_items.length === 0 && validation.valid_items.length > 0;

    res.json(validation);

  } catch (error) {
    console.error('Validate cart error:', error);
    res.status(500).json({ message: 'Error validating cart' });
  }
});

// Error handling middleware specific to scheduler routes
router.use((error, req, res, next) => {
  console.error('Scheduler route error:', error);
  
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
      message: 'Invalid reference - please check your data'
    });
  }
  
  if (error.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      message: 'Item already exists in cart',
      field: error.errors[0]?.path
    });
  }
  
  res.status(500).json({
    message: 'An error occurred processing your request',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
});

module.exports = router;