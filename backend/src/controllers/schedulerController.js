// backend/src/controllers/schedulerController.js
const { 
  ShoppingCart, 
  IceTimeRequest, 
  Episode, 
  Program, 
  User, 
  Facility, 
  Resource, 
  Event,
  RealtimeNotification 
} = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

const schedulerController = {
  // =============================================
  // SHOPPING CART OPERATIONS
  // =============================================

  // Get user's shopping cart
  async getShoppingCart(req, res) {
    try {
      const { user_id } = req.user;
      const { program_id } = req.query;

      const whereClause = { user_id };
      if (program_id) {
        whereClause.program_id = program_id;
      }

      const cartItems = await ShoppingCart.findAll({
        where: whereClause,
        include: [
          {
            model: Program,
            as: 'program',
            attributes: ['program_id', 'program_name']
          },
          {
            model: Episode,
            as: 'episode',
            attributes: ['episode_id', 'episode_status'],
            include: [{
              model: Event,
              as: 'event',
              include: [{
                model: Resource,
                as: 'resource',
                include: [{
                  model: Facility,
                  as: 'facility',
                  attributes: ['facility_name', 'facility_time_zone']
                }]
              }]
            }]
          }
        ],
        order: [['added_at', 'DESC']]
      });

      // Filter out items where episode is no longer available
      const validItems = cartItems.filter(item => 
        ['available', 'assigned'].includes(item.episode.episode_status)
      );

      // Calculate totals
      const totalItems = validItems.length;
      const totalCost = validItems.reduce((sum, item) => 
        sum + (parseFloat(item.episode_price) || 0), 0
      );

      res.json({
        cart_items: validItems,
        total_items: totalItems,
        total_cost: totalCost.toFixed(2),
        program_breakdown: getCartBreakdownByProgram(validItems)
      });

    } catch (error) {
      console.error('Get shopping cart error:', error);
      res.status(500).json({ message: 'Error fetching shopping cart' });
    }
  },

  // Add item to shopping cart
  async addToCart(req, res) {
    let transaction = null;
    
    try {
      const { user_id } = req.user;
      const { 
        episode_id, 
        program_id, 
        notes = '', 
        priority = 'normal' 
      } = req.body;

      // Validate required fields
      if (!episode_id || !program_id) {
        return res.status(400).json({ 
          message: 'Episode ID and Program ID are required' 
        });
      }

      transaction = await sequelize.transaction();

      // Get episode with full details
      const episode = await Episode.findByPk(episode_id, {
        include: [{
          model: Event,
          as: 'event',
          include: [{
            model: Resource,
            as: 'resource',
            include: [{
              model: Facility,
              as: 'facility'
            }]
          }]
        }],
        transaction
      });

      if (!episode) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Episode not found' });
      }

      // Verify episode is available
      if (!['available', 'assigned'].includes(episode.episode_status)) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'This ice time is no longer available' 
        });
      }

      // Check for past episodes
      if (new Date(episode.episode_start_date_time) < new Date()) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Cannot add past ice time to cart' 
        });
      }

      // Verify user has access to this program
      const program = await Program.findOne({
        where: {
          program_id,
          [Op.or]: [
            { scheduler_user_id: user_id },
            { program_admin_user_id: user_id }
          ]
        },
        transaction
      });

      if (!program) {
        await transaction.rollback();
        return res.status(403).json({ 
          message: 'You do not have access to this program' 
        });
      }

      // Check if already in cart
      const existingItem = await ShoppingCart.findOne({
        where: { user_id, episode_id },
        transaction
      });

      if (existingItem) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'This ice time is already in your cart' 
        });
      }

      // Create cart item
      const cartItem = await ShoppingCart.create({
        user_id,
        program_id,
        episode_id,
        facility_id: episode.event.resource.facility_id,
        resource_id: episode.event.resource_id,
        episode_start_date_time: episode.episode_start_date_time,
        episode_end_date_time: episode.episode_end_date_time,
        episode_title: episode.episode_title,
        episode_price: episode.episode_price,
        resource_name: episode.event.resource.resource_name,
        facility_name: episode.event.resource.facility.facility_name,
        session_id: req.sessionID,
        notes,
        priority
      }, { transaction });

      await transaction.commit();

      // Broadcast real-time update
      const facilityId = episode.event.resource.facility_id;
      await RealtimeNotification.createForFacility(facilityId, 'cart:item_added', {
        title: 'Ice Time Added to Cart',
        message: `${req.user.first_name} ${req.user.last_name} added ice time to cart`,
        cart_item_id: cartItem.cart_id,
        episode_id,
        program_name: program.program_name,
        user_id,
        created_by_user_id: user_id
      });

      // Reload with associations
      const newCartItem = await ShoppingCart.findByPk(cartItem.cart_id, {
        include: ['program', 'episode']
      });

      res.status(201).json({
        message: 'Added to shopping cart',
        cart_item: newCartItem,
        cart_count: await ShoppingCart.getUserCartCount(user_id)
      });

    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      console.error('Add to cart error:', error);
      res.status(500).json({ message: 'Error adding to cart' });
    }
  },

  // Remove item from shopping cart
  async removeFromCart(req, res) {
    try {
      const { user_id } = req.user;
      const { cart_id } = req.params;

      const cartItem = await ShoppingCart.findOne({
        where: { cart_id, user_id },
        include: ['episode']
      });

      if (!cartItem) {
        return res.status(404).json({ message: 'Cart item not found' });
      }

      const facilityId = cartItem.facility_id;
      const episodeId = cartItem.episode_id;

      await cartItem.destroy();

      // Broadcast real-time update
      await RealtimeNotification.createForFacility(facilityId, 'cart:item_removed', {
        title: 'Ice Time Removed from Cart',
        message: `${req.user.first_name} ${req.user.last_name} removed ice time from cart`,
        episode_id: episodeId,
        user_id,
        created_by_user_id: user_id
      });

      res.json({
        message: 'Removed from shopping cart',
        cart_count: await ShoppingCart.getUserCartCount(user_id)
      });

    } catch (error) {
      console.error('Remove from cart error:', error);
      res.status(500).json({ message: 'Error removing from cart' });
    }
  },

  // Clear entire shopping cart
  async clearCart(req, res) {
    try {
      const { user_id } = req.user;
      const { program_id } = req.query;

      const whereClause = { user_id };
      if (program_id) {
        whereClause.program_id = program_id;
      }

      const deletedCount = await ShoppingCart.destroy({
        where: whereClause
      });

      res.json({
        message: `Cleared ${deletedCount} items from cart`,
        cart_count: await ShoppingCart.getUserCartCount(user_id)
      });

    } catch (error) {
      console.error('Clear cart error:', error);
      res.status(500).json({ message: 'Error clearing cart' });
    }
  },

  // Sync cart across sessions
  async syncCart(req, res) {
    try {
      const { user_id } = req.user;
      const { session_id } = req.body;

      // Update session_id for user's cart items
      await ShoppingCart.update(
        { session_id: req.sessionID },
        { where: { user_id } }
      );

      // Get updated cart
      const cartItems = await ShoppingCart.findAll({
        where: { user_id },
        include: ['program', 'episode'],
        order: [['added_at', 'DESC']]
      });

      res.json({
        message: 'Cart synchronized',
        cart_items: cartItems,
        cart_count: cartItems.length
      });

    } catch (error) {
      console.error('Sync cart error:', error);
      res.status(500).json({ message: 'Error synchronizing cart' });
    }
  },

  // =============================================
  // REQUEST SUBMISSION & MANAGEMENT
  // =============================================

  // Submit shopping cart as requests
  async submitCartRequests(req, res) {
    let transaction = null;
    
    try {
      const { user_id } = req.user;
      const { program_id, batch_notes = '' } = req.body;

      if (!program_id) {
        return res.status(400).json({ message: 'Program ID is required' });
      }

      transaction = await sequelize.transaction();

      // Get cart items for this program
      const cartItems = await ShoppingCart.findAll({
        where: { user_id, program_id },
        include: ['episode'],
        transaction
      });

      if (cartItems.length === 0) {
        await transaction.rollback();
        return res.status(400).json({ message: 'No items in cart for this program' });
      }

      // Validate all episodes are still available
      const unavailableItems = cartItems.filter(item => 
        !['available', 'assigned'].includes(item.episode.episode_status)
      );

      if (unavailableItems.length > 0) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Some ice time slots are no longer available',
          unavailable_items: unavailableItems.map(item => ({
            cart_id: item.cart_id,
            episode_title: item.episode_title,
            current_status: item.episode.episode_status
          }))
        });
      }

      // Create requests for each cart item
      const createdRequests = [];
      const facilityUpdates = new Set();

      for (const cartItem of cartItems) {
        // Check for conflicting requests (first-come-first-served)
        const existingRequest = await IceTimeRequest.findOne({
          where: {
            episode_id: cartItem.episode_id,
            request_status: 'pending'
          },
          transaction
        });

        if (existingRequest) {
          // Skip this item but continue with others
          console.log(`Episode ${cartItem.episode_id} already has pending request`);
          continue;
        }

        const request = await IceTimeRequest.create({
          user_id,
          program_id,
          episode_id: cartItem.episode_id,
          facility_id: cartItem.facility_id,
          resource_id: cartItem.resource_id,
          requested_start_time: cartItem.episode_start_date_time,
          requested_end_time: cartItem.episode_end_date_time,
          episode_price: cartItem.episode_price,
          request_notes: cartItem.notes || batch_notes,
          priority: cartItem.priority,
          created_by: req.user.username
        }, { transaction });

        createdRequests.push(request);
        facilityUpdates.add(cartItem.facility_id);

        // Update episode status to 'pending' if it was 'available'
        if (cartItem.episode.episode_status === 'available') {
          await Episode.update(
            { episode_status: 'pending' },
            { 
              where: { episode_id: cartItem.episode_id },
              transaction 
            }
          );
        }
      }

      // Clear submitted cart items
      await ShoppingCart.destroy({
        where: { 
          user_id, 
          program_id,
          episode_id: {
            [Op.in]: createdRequests.map(r => r.episode_id)
          }
        },
        transaction
      });

      await transaction.commit();

      // Broadcast real-time notifications
      for (const facilityId of facilityUpdates) {
        await RealtimeNotification.createForFacility(facilityId, 'requests:new_batch', {
          title: 'New Ice Time Requests',
          message: `${req.user.first_name} ${req.user.last_name} submitted ${createdRequests.length} ice time requests`,
          request_count: createdRequests.length,
          program_id,
          user_id,
          created_by_user_id: user_id
        });
      }

      res.status(201).json({
        message: `Submitted ${createdRequests.length} ice time requests`,
        requests: createdRequests,
        remaining_cart_items: await ShoppingCart.getUserCartCount(user_id)
      });

    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      console.error('Submit cart requests error:', error);
      res.status(500).json({ message: 'Error submitting requests' });
    }
  },

  // Get user's ice time requests
  async getMyRequests(req, res) {
    try {
      const { user_id } = req.user;
      const { 
        status, 
        program_id, 
        facility_id,
        page = 1, 
        limit = 50 
      } = req.query;

      const whereClause = { user_id };
      
      if (status) {
        whereClause.request_status = status;
      }
      if (program_id) {
        whereClause.program_id = program_id;
      }
      if (facility_id) {
        whereClause.facility_id = facility_id;
      }

      const offset = (page - 1) * limit;

      const { count, rows } = await IceTimeRequest.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Program,
            as: 'program',
            attributes: ['program_id', 'program_name']
          },
          {
            model: Facility,
            as: 'facility',
            attributes: ['facility_id', 'facility_name', 'facility_time_zone']
          },
          {
            model: Resource,
            as: 'resource',
            attributes: ['resource_id', 'resource_name']
          },
          {
            model: User,
            as: 'reviewedBy',
            attributes: ['user_id', 'first_name', 'last_name']
          }
        ],
        order: [['submitted_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        requests: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        },
        status_summary: await getRequestStatusSummary(user_id)
      });

    } catch (error) {
      console.error('Get my requests error:', error);
      res.status(500).json({ message: 'Error fetching requests' });
    }
  },

  // Cancel a pending request
  async cancelRequest(req, res) {
    let transaction = null;
    
    try {
      const { user_id } = req.user;
      const { request_id } = req.params;

      transaction = await sequelize.transaction();

      const request = await IceTimeRequest.findOne({
        where: { request_id, user_id },
        include: ['episode', 'facility'],
        transaction
      });

      if (!request) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Request not found' });
      }

      if (!request.canBeCancelled()) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'This request cannot be cancelled' 
        });
      }

      // Update request status
      await request.update({
        request_status: 'cancelled',
        reviewed_at: new Date(),
        admin_notes: 'Cancelled by user',
        updated_by: req.user.username
      }, { transaction });

      // Revert episode status if it was pending
      if (request.episode.episode_status === 'pending') {
        await Episode.update(
          { episode_status: 'available' },
          { 
            where: { episode_id: request.episode_id },
            transaction 
          }
        );
      }

      await transaction.commit();

      // Broadcast real-time notification
      await RealtimeNotification.createForFacility(request.facility_id, 'requests:cancelled', {
        title: 'Request Cancelled',
        message: `${req.user.first_name} ${req.user.last_name} cancelled ice time request ${request.request_number}`,
        request_id: request.request_id,
        request_number: request.request_number,
        user_id,
        created_by_user_id: user_id
      });

      res.json({
        message: 'Request cancelled successfully',
        request: request
      });

    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      console.error('Cancel request error:', error);
      res.status(500).json({ message: 'Error cancelling request' });
    }
  },

  // =============================================
  // FILTERED EPISODES FOR SCHEDULER VIEW
  // =============================================

  // Get episodes filtered for scheduler view
  async getFilteredEpisodes(req, res) {
    try {
      const { user_id } = req.user;
      const { 
        start, 
        end, 
        facility_id, 
        program_id,
        show_public_available = 'true',
        show_assigned_to_me = 'true',
        show_my_bookings = 'true',
        show_other_bookings = 'false'
      } = req.query;

      // Get user's programs
      const userPrograms = await Program.findAll({
        where: {
          [Op.or]: [
            { scheduler_user_id: user_id },
            { program_admin_user_id: user_id }
          ]
        },
        attributes: ['program_id']
      });

      const programIds = userPrograms.map(p => p.program_id);

      // Build episode filter conditions
      const episodeConditions = [];

      // Public available ice
      if (show_public_available === 'true') {
        episodeConditions.push({
          episode_status: 'available',
          assigned_to_program_id: null
        });
      }

      // Ice assigned to user's programs
      if (show_assigned_to_me === 'true' && programIds.length > 0) {
        episodeConditions.push({
          episode_status: 'assigned',
          assigned_to_program_id: { [Op.in]: programIds }
        });
      }

      // User's confirmed bookings
      if (show_my_bookings === 'true' && programIds.length > 0) {
        episodeConditions.push({
          episode_status: 'booked',
          [Op.or]: [
            { program_id: { [Op.in]: programIds } },
            { assigned_to_program_id: { [Op.in]: programIds } }
          ]
        });
      }

      // Other programs' bookings (for context)
      if (show_other_bookings === 'true') {
        episodeConditions.push({
          episode_status: 'booked',
          [Op.and]: [
            { program_id: { [Op.notIn]: programIds } },
            { assigned_to_program_id: { [Op.notIn]: programIds } }
          ]
        });
      }

      if (episodeConditions.length === 0) {
        return res.json({ events: [], total: 0 });
      }

      // Base episode query
      const whereClause = {
        [Op.or]: episodeConditions
      };

      // Date range filter
      if (start && end) {
        whereClause.episode_start_date_time = {
          [Op.between]: [new Date(start), new Date(end)]
        };
      }

      // Build include array
      const includeArray = [
        {
          model: Event,
          as: 'event',
          required: true,
          include: [
            {
              model: Resource,
              as: 'resource',
              required: true,
              where: facility_id ? { facility_id } : {},
              include: [
                {
                  model: Facility,
                  as: 'facility',
                  required: true
                }
              ]
            }
          ]
        },
        {
          model: Program,
          as: 'program',
          required: false
        },
        {
          model: Program,
          as: 'assignedProgram',
          required: false
        }
      ];

      const episodes = await Episode.findAll({
        where: whereClause,
        include: includeArray,
        order: [['episode_start_date_time', 'ASC']],
        limit: 1000
      });

      // Check which episodes are in user's cart
      const cartEpisodeIds = await ShoppingCart.findAll({
        where: { user_id },
        attributes: ['episode_id']
      }).then(items => items.map(item => item.episode_id));

      // Format for calendar
      const calendarEvents = episodes.map(episode => {
        const facility = episode.event.resource.facility;
        const isInCart = cartEpisodeIds.includes(episode.episode_id);
        const isUserProgram = programIds.includes(episode.program_id) || 
                            programIds.includes(episode.assigned_to_program_id);

        return {
          id: episode.episode_id,
          title: episode.episode_title || 'Ice Time',
          start: episode.episode_start_date_time,
          end: episode.episode_end_date_time,
          resourceId: episode.event.resource_id,
          backgroundColor: getSchedulerEventColor(episode, isUserProgram, isInCart),
          borderColor: getSchedulerEventColor(episode, isUserProgram, isInCart),
          textColor: getSchedulerTextColor(episode, isUserProgram, isInCart),
          extendedProps: {
            episodeId: episode.episode_id,
            status: episode.episode_status,
            price: episode.episode_price ? `$${parseFloat(episode.episode_price).toFixed(2)}` : 'N/A',
            duration: episode.episode_duration,
            facility: facility.facility_name,
            facilityTimezone: facility.facility_time_zone,
            resource: episode.event.resource.resource_name,
            program: episode.program?.program_name || null,
            assignedProgram: episode.assignedProgram?.program_name || null,
            canRequest: canRequestEpisode(episode, user_id, programIds),
            inShoppingCart: isInCart,
            isUserProgram: isUserProgram,
            description: episode.episode_description
          }
        };
      });

      res.json({
        events: calendarEvents,
        total: episodes.length,
        user_programs: userPrograms,
        cart_count: cartEpisodeIds.length
      });

    } catch (error) {
      console.error('Get filtered episodes error:', error);
      res.status(500).json({ message: 'Error fetching episodes' });
    }
  }
};

// =============================================
// HELPER FUNCTIONS
// =============================================

function getCartBreakdownByProgram(cartItems) {
  const breakdown = {};
  
  cartItems.forEach(item => {
    const programId = item.program_id;
    const programName = item.program?.program_name || 'Unknown Program';
    
    if (!breakdown[programId]) {
      breakdown[programId] = {
        program_name: programName,
        item_count: 0,
        total_cost: 0
      };
    }
    
    breakdown[programId].item_count += 1;
    breakdown[programId].total_cost += parseFloat(item.episode_price) || 0;
  });
  
  return breakdown;
}

async function getRequestStatusSummary(userId) {
  const summary = await IceTimeRequest.findAll({
    where: { user_id: userId },
    attributes: [
      'request_status',
      [sequelize.fn('COUNT', sequelize.col('request_id')), 'count']
    ],
    group: ['request_status'],
    raw: true
  });
  
  return summary.reduce((acc, item) => {
    acc[item.request_status] = parseInt(item.count);
    return acc;
  }, {});
}

function getSchedulerEventColor(episode, isUserProgram, isInCart) {
  if (isInCart) return '#9f7aea'; // Purple for cart items
  
  switch (episode.episode_status) {
    case 'available':
      return isUserProgram ? '#ed8936' : '#48bb78'; // Orange for assigned, green for public
    case 'assigned':
      return isUserProgram ? '#ed8936' : '#a0aec0'; // Orange for user's, gray for others
    case 'pending':
      return '#f6ad55'; // Yellow for pending
    case 'booked':
      return isUserProgram ? '#4299e1' : '#a0aec0'; // Blue for user's bookings, gray for others
    default:
      return '#9e9e9e';
  }
}

function getSchedulerTextColor(episode, isUserProgram, isInCart) {
  if (isInCart || episode.episode_status === 'booked') return '#ffffff';
  return '#000000';
}

function canRequestEpisode(episode, userId, userProgramIds) {
  // Can request if:
  // 1. Available and not assigned, OR
  // 2. Assigned to one of user's programs
  if (episode.episode_status === 'available' && !episode.assigned_to_program_id) {
    return true;
  }
  
  if (episode.episode_status === 'assigned' && 
      episode.assigned_to_program_id && 
      userProgramIds.includes(episode.assigned_to_program_id)) {
    return true;
  }
  
  return false;
}

module.exports = schedulerController;