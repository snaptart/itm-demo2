// backend/src/controllers/episodeController.js (Fixed UTC Handling)
const { Episode, Event, Resource, Facility, Program, Booking, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

// Import conflict detection service with fallback
let conflictDetectionService;
try {
  conflictDetectionService = require('../services/conflictDetectionService');
} catch (error) {
  console.warn('ConflictDetectionService not available, using fallback');
  conflictDetectionService = {
    checkEpisodeConflicts: async () => ({ conflicts: [], warnings: [] }),
    checkBatchConflicts: async () => []
  };
}

const episodeController = {
  // Get episodes - return UTC times for frontend to convert
  async getEpisodes(req, res) {
    try {
      const { 
        start, 
        end, 
        facility_id, 
        resource_id, 
        status,
        program_id
      } = req.query;

      console.log('GET /api/episodes - Query params:', { start, end, facility_id, resource_id });

      // Build where clause
      const whereClause = {};
      
      // Date range filter - expect UTC from frontend
      if (start && end) {
        const utcStartDate = new Date(start);
        const utcEndDate = new Date(end);
        
        if (!isNaN(utcStartDate.getTime()) && !isNaN(utcEndDate.getTime())) {
          whereClause.episode_start_date_time = {
            [Op.between]: [utcStartDate, utcEndDate]
          };
        }
      }

      // Status filter
      if (status) {
        whereClause.episode_status = status;
      }

      // Program filter
      if (program_id) {
        whereClause[Op.or] = [
          { program_id: program_id },
          { assigned_to_program_id: program_id }
        ];
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
              where: resource_id ? { resource_id } : {},
              include: [
                {
                  model: Facility,
                  as: 'facility',
                  required: true,
                  where: facility_id ? { facility_id } : {}
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

      // For schedulers, filter appropriately
      if (req.user && req.user.user_type === 'scheduler') {
        const userPrograms = await Program.findAll({
          where: { scheduler_user_id: req.user.user_id },
          attributes: ['program_id']
        });
        
        const programIds = userPrograms.map(p => p.program_id);
        
        if (programIds.length > 0) {
          whereClause[Op.or] = [
            { episode_status: 'available' },
            { program_id: { [Op.in]: programIds } },
            { assigned_to_program_id: { [Op.in]: programIds } }
          ];
        } else {
          whereClause.episode_status = 'available';
        }
      }

      const episodes = await Episode.findAll({
        where: whereClause,
        include: includeArray,
        order: [['episode_start_date_time', 'ASC']],
        limit: 1000
      });

      console.log(`Found ${episodes.length} episodes`);

      // FIXED: Return UTC times - let frontend handle timezone conversion
      const calendarEvents = episodes.map(episode => {
        const facility = episode.event?.resource?.facility;
        
        return {
          id: episode.episode_id,
          title: episode.episode_title || 'Ice Time',
          // Return UTC times - frontend will convert for display
          start: episode.episode_start_date_time.toISOString(),
          end: episode.episode_end_date_time.toISOString(),
          resourceId: episode.event.resource_id,
          backgroundColor: getStatusColor(episode.episode_status, req.user?.user_type, episode),
          borderColor: getStatusColor(episode.episode_status, req.user?.user_type, episode),
          textColor: episode.episode_status === 'available' ? '#000000' : '#FFFFFF',
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
            canBook: ['available', 'assigned'].includes(episode.episode_status),
            canEdit: canEditEpisode(episode, req.user),
            description: episode.episode_description
          }
        };
      });

      // Get facility timezone if facility_id provided
      let timezone = null;
      if (facility_id) {
        const facility = await Facility.findByPk(facility_id);
        timezone = facility?.facility_time_zone;
      }

      res.json({
        events: calendarEvents,
        total: episodes.length,
        timezone
      });

    } catch (error) {
      console.error('GET /api/episodes error:', error);
      res.status(500).json({ 
        message: 'An error occurred while fetching episodes',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Get single episode - return UTC times
  async getEpisodeById(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return res.status(400).json({ 
          message: 'Invalid episode ID' 
        });
      }

      const episode = await Episode.findByPk(id, {
        include: [
          {
            model: Event,
            as: 'event',
            include: [
              {
                model: Resource,
                as: 'resource',
                include: [
                  {
                    model: Facility,
                    as: 'facility'
                  }
                ]
              }
            ]
          },
          {
            model: Program,
            as: 'program'
          },
          {
            model: Program,
            as: 'assignedProgram'
          },
          {
            model: Booking,
            as: 'bookings',
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['user_id', 'username', 'email', 'first_name', 'last_name']
              },
              {
                model: Program,
                as: 'program'
              }
            ]
          }
        ]
      });

      if (!episode) {
        return res.status(404).json({ 
          message: 'Episode not found' 
        });
      }

      const facility = episode.event.resource.facility;

      // Check permissions
      let canViewFullDetails = req.user.user_type === 'admin';
      
      if (req.user.user_type === 'scheduler') {
        const userPrograms = await Program.findAll({
          where: { scheduler_user_id: req.user.user_id },
          attributes: ['program_id']
        });
        
        const programIds = userPrograms.map(p => p.program_id);
        canViewFullDetails = programIds.includes(episode.program_id) || 
                           programIds.includes(episode.assigned_to_program_id);
      }

      // FIXED: Return UTC times
      res.json({
        episode: {
          ...episode.toJSON(),
          facilityTimezone: facility.facility_time_zone
        },
        canViewFullDetails
      });

    } catch (error) {
      console.error('GET /api/episodes/:id error:', error);
      res.status(500).json({ 
        message: 'An error occurred while fetching episode',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Validate episode move - expect UTC times
  async validateEpisodeMove(req, res) {
    try {
      const { 
        episode_id, 
        new_start_time, 
        new_end_time, 
        facility_id 
      } = req.body;

      console.log('POST /api/episodes/validate-move:', { episode_id, new_start_time, new_end_time });

      // Validate required fields
      if (!episode_id || !new_start_time || !new_end_time) {
        return res.status(400).json({ 
          message: 'Episode ID, new start time, and new end time are required' 
        });
      }

      // Get episode for context
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
        }]
      });

      if (!episode) {
        return res.status(404).json({ 
          message: 'Episode not found' 
        });
      }

      // Times are already UTC from frontend
      const utcNewStart = new Date(new_start_time);
      const utcNewEnd = new Date(new_end_time);

      if (isNaN(utcNewStart.getTime()) || isNaN(utcNewEnd.getTime())) {
        return res.json({
          valid: false,
          conflicts: [{
            type: 'invalid_date',
            severity: 'error',
            title: 'Invalid Date',
            description: 'Invalid date format provided'
          }],
          warnings: []
        });
      }

      // Check conflicts using UTC times
      const conflictResult = await conflictDetectionService.checkEpisodeConflicts({
        episodeId: episode_id,
        resourceId: episode.event.resource_id,
        newStartTime: utcNewStart,
        newEndTime: utcNewEnd,
        facilityId: facility_id || episode.event.resource.facility_id
      });

      const isValid = conflictResult.conflicts.length === 0;

      res.json({
        valid: isValid,
        conflicts: conflictResult.conflicts,
        warnings: conflictResult.warnings
      });

    } catch (error) {
      console.error('POST /api/episodes/validate-move error:', error);
      res.status(500).json({ 
        message: 'An error occurred while validating the move',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Move episode - work with UTC times
  async moveEpisode(req, res) {
    console.log('PUT /api/episodes/:id/move called');
    
    let transaction = null;
    
    try {
      const { id } = req.params;
      const { new_start_time, new_end_time } = req.body;

      console.log(`Moving episode ${id} to ${new_start_time} - ${new_end_time}`);

      // Validate required fields
      if (!new_start_time || !new_end_time) {
        return res.status(400).json({ 
          message: 'New start time and end time are required' 
        });
      }

      // Start transaction
      transaction = await sequelize.transaction();

      const episode = await Episode.findByPk(id, {
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
        return res.status(404).json({ 
          message: 'Episode not found' 
        });
      }

      // Check permission
      if (req.user.user_type !== 'admin') {
        await transaction.rollback();
        return res.status(403).json({ 
          message: 'Only administrators can move ice time slots' 
        });
      }

      // Times are already UTC from frontend
      const utcNewStartDate = new Date(new_start_time);
      const utcNewEndDate = new Date(new_end_time);

      if (isNaN(utcNewStartDate.getTime()) || isNaN(utcNewEndDate.getTime())) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Invalid date format' 
        });
      }

      // Check for conflicts
      const overlappingEpisodes = await Episode.findAll({
        where: {
          episode_id: { [Op.ne]: id },
          [Op.or]: [
            {
              episode_start_date_time: {
                [Op.between]: [utcNewStartDate, utcNewEndDate]
              }
            },
            {
              episode_end_date_time: {
                [Op.between]: [utcNewStartDate, utcNewEndDate]
              }
            },
            {
              [Op.and]: [
                {
                  episode_start_date_time: {
                    [Op.lte]: utcNewStartDate
                  }
                },
                {
                  episode_end_date_time: {
                    [Op.gte]: utcNewEndDate
                  }
                }
              ]
            }
          ]
        },
        include: [{
          model: Event,
          as: 'event',
          where: {
            resource_id: episode.event.resource_id
          },
          required: true
        }],
        transaction
      });

      if (overlappingEpisodes.length > 0) {
        await transaction.rollback();
        return res.status(400).json({
          message: 'Move would create schedule conflicts',
          conflicts: overlappingEpisodes.map(ep => ({
            episodeId: ep.episode_id,
            title: ep.episode_title,
            start: ep.episode_start_date_time.toISOString(),
            end: ep.episode_end_date_time.toISOString()
          }))
        });
      }

      // Calculate duration
      const duration = Math.round((utcNewEndDate - utcNewStartDate) / (1000 * 60));

      // Update episode with UTC times
      await episode.update({
        episode_start_date_time: utcNewStartDate,
        episode_end_date_time: utcNewEndDate,
        episode_duration: duration,
        updated_by: req.user.username
      }, { transaction });

      await transaction.commit();

      console.log(`Successfully moved episode ${id}`);

      // Reload with associations
      const updatedEpisode = await Episode.findByPk(id, {
        include: [
          {
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
          }
        ]
      });

      // Return UTC times
      res.json({
        message: 'Episode moved successfully',
        episode: {
          ...updatedEpisode.toJSON(),
          facilityTimezone: updatedEpisode.event.resource.facility.facility_time_zone
        }
      });

    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      console.error('PUT /api/episodes/:id/move error:', error);
      res.status(500).json({ 
        message: 'An error occurred while moving the episode',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Resize episode - work with UTC times
  async resizeEpisode(req, res) {
    console.log('PUT /api/episodes/:id/resize called');
    
    let transaction = null;
    
    try {
      const { id } = req.params;
      const { new_end_time } = req.body;

      console.log(`Resizing episode ${id} to end at ${new_end_time}`);

      if (!new_end_time) {
        return res.status(400).json({ 
          message: 'New end time is required' 
        });
      }

      // Start transaction
      transaction = await sequelize.transaction();

      const episode = await Episode.findByPk(id, {
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
        return res.status(404).json({ 
          message: 'Episode not found' 
        });
      }

      // Check permission
      if (req.user.user_type !== 'admin') {
        await transaction.rollback();
        return res.status(403).json({ 
          message: 'Only administrators can resize ice time slots' 
        });
      }

      // Time is already UTC from frontend
      const utcNewEndDate = new Date(new_end_time);
      
      if (isNaN(utcNewEndDate.getTime())) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Invalid date format' 
        });
      }

      const utcStartDate = new Date(episode.episode_start_date_time);
      
      if (utcNewEndDate <= utcStartDate) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'End time must be after start time' 
        });
      }

      // Calculate duration
      const duration = Math.round((utcNewEndDate - utcStartDate) / (1000 * 60));

      // Validate duration
      if (duration < 30) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Duration must be at least 30 minutes' 
        });
      }

      if (duration > 480) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Duration cannot exceed 8 hours' 
        });
      }

      // Update episode
      await episode.update({
        episode_end_date_time: utcNewEndDate,
        episode_duration: duration,
        updated_by: req.user.username
      }, { transaction });

      await transaction.commit();

      console.log(`Successfully resized episode ${id} to ${duration} minutes`);

      // Reload with associations
      const updatedEpisode = await Episode.findByPk(id, {
        include: [
          {
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
          }
        ]
      });

      // Return UTC times
      res.json({
        message: 'Episode resized successfully',
        episode: {
          ...updatedEpisode.toJSON(),
          facilityTimezone: updatedEpisode.event.resource.facility.facility_time_zone
        }
      });

    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      console.error('PUT /api/episodes/:id/resize error:', error);
      res.status(500).json({ 
        message: 'An error occurred while resizing the episode',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Get calendar resources (unchanged)
  async getCalendarResources(req, res) {
    try {
      const { facility_id } = req.query;

      const whereClause = { resource_status: 'active' };
      if (facility_id) {
        whereClause.facility_id = facility_id;
      }

      const resources = await Resource.findAll({
        where: whereClause,
        include: [{
          model: Facility,
          as: 'facility',
          attributes: ['facility_id', 'facility_name', 'facility_time_zone']
        }],
        order: [
          ['facility_id', 'ASC'],
          ['resource_name', 'ASC']
        ]
      });

      const calendarResources = resources.map(resource => ({
        id: resource.resource_id.toString(),
        title: resource.resource_name,
        facility: resource.facility.facility_name,
        facilityId: resource.facility_id,
        facilityTimezone: resource.facility.facility_time_zone,
        extendedProps: {
          resourceType: resource.resource_type_id,
          description: resource.resource_desc
        }
      }));

      res.json({
        resources: calendarResources,
        total: resources.length
      });

    } catch (error) {
      console.error('GET /api/episodes/resources error:', error);
      res.status(500).json({ 
        message: 'An error occurred while fetching calendar resources',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Placeholder methods
  async validateBatchMoves(req, res) {
    res.status(501).json({ message: 'Batch validation not yet implemented' });
  },

  async createEpisode(req, res) {
    res.status(501).json({ message: 'Create episode not yet implemented' });
  },

  async updateEpisode(req, res) {
    res.status(501).json({ message: 'Update episode not yet implemented' });
  },

  async deleteEpisode(req, res) {
    res.status(501).json({ message: 'Delete episode not yet implemented' });
  }
};

// Helper function to get status color
function getStatusColor(status, userType, episode = null) {
  const statusColors = {
    'available': '#FFFFFF',
    'assigned': '#FFEB3B',
    'pending': '#FFEB3B',
    'booked': '#4CAF50',
    'maintenance': '#9E9E9E',
    'cancelled': '#9E9E9E'
  };
  
  // Admin view special case
  if (userType === 'admin' && status === 'assigned' && episode?.assigned_to_program_id) {
    return '#2196F3';
  }
  
  return statusColors[status] || '#FFFFFF';
}

// Helper function to check if episode can be edited
function canEditEpisode(episode, user) {
  if (!episode || !user) return false;
  
  // Only admins can edit
  if (user.user_type !== 'admin') return false;
  
  // Cannot edit past episodes
  if (new Date(episode.episode_start_date_time) < new Date()) {
    return false;
  }
  
  // Cannot edit booked episodes
  if (episode.episode_status === 'booked') return false;
  
  // Cannot edit if it has active bookings
  if (episode.bookings && episode.bookings.some(b => ['pending', 'approved'].includes(b.booking_status))) {
    return false;
  }
  
  return true;
}

module.exports = episodeController;