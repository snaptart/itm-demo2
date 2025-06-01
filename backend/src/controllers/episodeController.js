// backend/src/controllers/episodeController.js (Fixed for Phase 3B)
const { Episode, Event, Resource, Facility, Program, Booking, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

// Fixed imports and error handling
let TimezoneUtils;
let conflictDetectionService;
let businessRulesValidator;

// Graceful service loading with fallbacks
try {
  TimezoneUtils = require('../utils/timezoneUtils');
} catch (error) {
  console.warn('TimezoneUtils not available, using fallback');
  TimezoneUtils = {
    DEFAULT_TIMEZONE: 'America/Chicago',
    parseAndConvertToUTC: (dateTime) => new Date(dateTime),
    convertToFacilityTime: (dateTime) => new Date(dateTime),
    formatForDisplay: (dateTime) => new Date(dateTime).toLocaleString(),
    calculateDurationWithDST: (start, end) => Math.round((new Date(end) - new Date(start)) / (1000 * 60))
  };
}

try {
  conflictDetectionService = require('../services/conflictDetectionService');
} catch (error) {
  console.warn('ConflictDetectionService not available, using fallback');
  conflictDetectionService = {
    checkEpisodeConflicts: async () => ({ conflicts: [], warnings: [] }),
    checkBatchConflicts: async () => []
  };
}

try {
  businessRulesValidator = require('../utils/businessRulesValidator');
} catch (error) {
  console.warn('BusinessRulesValidator not available, using fallback');
  businessRulesValidator = {
    validateEpisodeMove: async () => ({ violations: [], warnings: [] }),
    validateBatchMoves: async () => []
  };
}

const episodeController = {
  // Get episodes for calendar view with enhanced error handling
  async getEpisodes(req, res) {
    try {
      const { 
        start, 
        end, 
        facility_id, 
        resource_id, 
        status,
        program_id,
        timezone
      } = req.query;

      console.log('GET /api/episodes - Query params:', { start, end, facility_id, resource_id });

      // Build where clause
      const whereClause = {};
      
      // Get facility for timezone context
      let facilityTimezone = TimezoneUtils.DEFAULT_TIMEZONE;
      let facility = null;
      
      if (facility_id) {
        try {
          facility = await Facility.findByPk(facility_id);
          facilityTimezone = facility?.facility_time_zone || TimezoneUtils.DEFAULT_TIMEZONE;
        } catch (facilityError) {
          console.warn('Failed to fetch facility for timezone:', facilityError.message);
        }
      }

      // Date range filter with safe parsing
      if (start && end) {
        try {
          const startDate = new Date(start);
          const endDate = new Date(end);
          
          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            if (startDate <= endDate) {
              whereClause.episode_start_date_time = {
                [Op.between]: [startDate, endDate]
              };
            } else {
              return res.status(400).json({ 
                message: 'Start date must be before end date' 
              });
            }
          } else {
            return res.status(400).json({ 
              message: 'Invalid date format' 
            });
          }
        } catch (dateError) {
          console.error('Date parsing error:', dateError);
          return res.status(400).json({ 
            message: 'Invalid date format' 
          });
        }
      }

      // Status filter
      if (status) {
        whereClause.episode_status = status;
      }

      // Program filter (for schedulers to see their assigned episodes)
      if (program_id) {
        whereClause[Op.or] = [
          { program_id: program_id },
          { assigned_to_program_id: program_id }
        ];
      }

      // Build include array with error handling
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

      // For schedulers, filter to show only available slots or their program's slots
      if (req.user && req.user.user_type === 'scheduler') {
        try {
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
        } catch (programError) {
          console.warn('Failed to filter by user programs:', programError.message);
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

      // Transform episodes for calendar view
      const calendarEvents = episodes.map(episode => {
        const episodeFacilityTimezone = episode.event?.resource?.facility?.facility_time_zone || facilityTimezone;

        return {
          id: episode.episode_id,
          title: episode.episode_title || 'Ice Time',
          start: episode.episode_start_date_time,
          end: episode.episode_end_date_time,
          resourceId: episode.event.resource_id,
          backgroundColor: getStatusColor(episode.episode_status, req.user?.user_type, episode),
          borderColor: getStatusColor(episode.episode_status, req.user?.user_type, episode),
          textColor: episode.episode_status === 'available' ? '#000000' : '#FFFFFF',
          extendedProps: {
            episodeId: episode.episode_id,
            status: episode.episode_status,
            price: episode.episode_price ? `$${parseFloat(episode.episode_price).toFixed(2)}` : 'N/A',
            duration: episode.episode_duration,
            facility: episode.event.resource.facility.facility_name,
            facilityTimezone: episodeFacilityTimezone,
            resource: episode.event.resource.resource_name,
            program: episode.program?.program_name || null,
            assignedProgram: episode.assignedProgram?.program_name || null,
            canBook: ['available', 'assigned'].includes(episode.episode_status),
            canEdit: canEditEpisode(episode, req.user),
            description: episode.episode_description
          }
        };
      });

      res.json({
        events: calendarEvents,
        total: episodes.length,
        timezone: facilityTimezone
      });

    } catch (error) {
      console.error('GET /api/episodes error:', error);
      res.status(500).json({ 
        message: 'An error occurred while fetching episodes',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Validate episode move/resize with enhanced error handling
  async validateEpisodeMove(req, res) {
    try {
      const { 
        episode_id, 
        new_start_time, 
        new_end_time, 
        facility_id 
      } = req.body;

      console.log('POST /api/episodes/validate-move:', { episode_id, new_start_time, new_end_time, facility_id });

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

      const facility = episode.event.resource.facility;
      const actualFacilityId = facility_id || facility.facility_id;

      // Basic validation first
      const newStart = new Date(new_start_time);
      const newEnd = new Date(new_end_time);
      
      if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
        return res.json({
          valid: false,
          conflicts: [{
            type: 'invalid_date',
            severity: 'error',
            title: 'Invalid Date',
            description: 'Invalid date format provided'
          }],
          warnings: [],
          businessRuleViolations: ['Invalid date format']
        });
      }

      if (newStart >= newEnd) {
        return res.json({
          valid: false,
          conflicts: [{
            type: 'invalid_range',
            severity: 'error',
            title: 'Invalid Time Range',
            description: 'End time must be after start time'
          }],
          warnings: [],
          businessRuleViolations: ['Invalid time range']
        });
      }

      // Check if moving to past
      if (newStart < new Date()) {
        return res.json({
          valid: false,
          conflicts: [{
            type: 'past_date',
            severity: 'error',
            title: 'Past Date',
            description: 'Cannot move ice time to the past'
          }],
          warnings: [],
          businessRuleViolations: ['Cannot schedule in the past']
        });
      }

      // Check business rules with fallback
      let businessRules = { violations: [], warnings: [] };
      try {
        businessRules = await businessRulesValidator.validateEpisodeMove({
          episode,
          newStartTime: new_start_time,
          newEndTime: new_end_time,
          facilityId: actualFacilityId,
          userId: req.user.user_id
        });
      } catch (businessError) {
        console.warn('Business rules validation failed:', businessError.message);
      }

      // If business rules fail, return those violations
      if (businessRules.violations.length > 0) {
        return res.json({
          valid: false,
          conflicts: businessRules.violations,
          warnings: businessRules.warnings,
          businessRuleViolations: businessRules.violations.map(v => v.description)
        });
      }

      // Check for scheduling conflicts with fallback
      let conflictResult = { conflicts: [], warnings: [] };
      try {
        conflictResult = await conflictDetectionService.checkEpisodeConflicts({
          episodeId: episode_id,
          resourceId: episode.event.resource_id,
          newStartTime: new_start_time,
          newEndTime: new_end_time,
          facilityId: actualFacilityId
        });
      } catch (conflictError) {
        console.warn('Conflict detection failed:', conflictError.message);
      }

      const isValid = conflictResult.conflicts.length === 0;

      res.json({
        valid: isValid,
        conflicts: conflictResult.conflicts,
        warnings: [...businessRules.warnings, ...conflictResult.warnings],
        businessRuleViolations: []
      });

    } catch (error) {
      console.error('POST /api/episodes/validate-move error:', error);
      res.status(500).json({ 
        message: 'An error occurred while validating the move',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Move episode with comprehensive error handling and logging
  async moveEpisode(req, res) {
    console.log('PUT /api/episodes/:id/move called with params:', req.params, 'body:', req.body);
    
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      const { new_start_time, new_end_time, new_duration } = req.body;

      console.log(`Moving episode ${id} to ${new_start_time} - ${new_end_time}`);

      // Validate required fields
      if (!new_start_time || !new_end_time) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'New start time and end time are required' 
        });
      }

      // Validate date formats
      const newStartDate = new Date(new_start_time);
      const newEndDate = new Date(new_end_time);
      
      if (isNaN(newStartDate.getTime()) || isNaN(newEndDate.getTime())) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Invalid date format' 
        });
      }

      if (newStartDate >= newEndDate) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'End time must be after start time' 
        });
      }

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

      console.log(`Found episode: ${episode.episode_title}, current time: ${episode.episode_start_date_time} - ${episode.episode_end_date_time}`);

      const facility = episode.event.resource.facility;
      const facilityTimezone = facility.facility_time_zone || TimezoneUtils.DEFAULT_TIMEZONE;

      // Check permission - only facility admin can move episodes
      if (req.user.user_type !== 'admin') {
        await transaction.rollback();
        return res.status(403).json({ 
          message: 'Only administrators can move ice time slots' 
        });
      }

      // For now, simplified permission check - in production, verify facility ownership
      console.log(`User ${req.user.username} (${req.user.user_type}) moving episode at facility ${facility.facility_name}`);

      // Calculate duration with fallback
      let duration = new_duration;
      if (!duration) {
        try {
          duration = TimezoneUtils.calculateDurationWithDST(
            newStartDate, 
            newEndDate, 
            facilityTimezone
          );
        } catch (durationError) {
          console.warn('Duration calculation failed, using simple calculation:', durationError.message);
          duration = Math.round((newEndDate.getTime() - newStartDate.getTime()) / (1000 * 60));
        }
      }

      console.log(`Calculated duration: ${duration} minutes`);

      // Basic conflict check - look for overlapping episodes
      const overlappingEpisodes = await Episode.findAll({
        where: {
          episode_id: { [Op.ne]: id }, // Exclude current episode
          [Op.or]: [
            // New episode starts during existing episode
            {
              episode_start_date_time: {
                [Op.between]: [newStartDate, newEndDate]
              }
            },
            // New episode ends during existing episode
            {
              episode_end_date_time: {
                [Op.between]: [newStartDate, newEndDate]
              }
            },
            // New episode completely encompasses existing episode
            {
              [Op.and]: [
                {
                  episode_start_date_time: {
                    [Op.gte]: newStartDate
                  }
                },
                {
                  episode_end_date_time: {
                    [Op.lte]: newEndDate
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
            start: ep.episode_start_date_time,
            end: ep.episode_end_date_time
          }))
        });
      }

      // Update episode
      await episode.update({
        episode_start_date_time: newStartDate,
        episode_end_date_time: newEndDate,
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
          },
          {
            model: Program,
            as: 'program'
          },
          {
            model: Program,
            as: 'assignedProgram'
          }
        ]
      });

      res.json({
        message: 'Episode moved successfully',
        episode: updatedEpisode
      });

    } catch (error) {
      await transaction.rollback();
      console.error('PUT /api/episodes/:id/move error:', error);
      res.status(500).json({ 
        message: 'An error occurred while moving the episode',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Resize episode with comprehensive error handling
  async resizeEpisode(req, res) {
    console.log('PUT /api/episodes/:id/resize called with params:', req.params, 'body:', req.body);
    
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      const { new_end_time, new_duration } = req.body;

      console.log(`Resizing episode ${id} to end at ${new_end_time}`);

      // Validate required fields
      if (!new_end_time) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'New end time is required' 
        });
      }

      // Validate date format
      const newEndDate = new Date(new_end_time);
      
      if (isNaN(newEndDate.getTime())) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Invalid date format' 
        });
      }

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

      const startDate = new Date(episode.episode_start_date_time);
      
      if (newEndDate <= startDate) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'End time must be after start time' 
        });
      }

      // Check permission
      if (req.user.user_type !== 'admin') {
        await transaction.rollback();
        return res.status(403).json({ 
          message: 'Only administrators can resize ice time slots' 
        });
      }

      // Calculate duration
      let duration = new_duration;
      if (!duration) {
        try {
          const facility = episode.event.resource.facility;
          const facilityTimezone = facility.facility_time_zone || TimezoneUtils.DEFAULT_TIMEZONE;
          duration = TimezoneUtils.calculateDurationWithDST(
            startDate, 
            newEndDate, 
            facilityTimezone
          );
        } catch (durationError) {
          console.warn('Duration calculation failed, using simple calculation:', durationError.message);
          duration = Math.round((newEndDate.getTime() - startDate.getTime()) / (1000 * 60));
        }
      }

      // Basic validation - check duration limits
      if (duration < 30) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Duration must be at least 30 minutes' 
        });
      }

      if (duration > 480) { // 8 hours
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Duration cannot exceed 8 hours' 
        });
      }

      // Update episode
      await episode.update({
        episode_end_date_time: newEndDate,
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

      res.json({
        message: 'Episode resized successfully',
        episode: updatedEpisode
      });

    } catch (error) {
      await transaction.rollback();
      console.error('PUT /api/episodes/:id/resize error:', error);
      res.status(500).json({ 
        message: 'An error occurred while resizing the episode',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Get calendar resources (facilities and rinks)
  async getCalendarResources(req, res) {
    try {
      const { facility_id } = req.query;

      const whereClause = { resource_status: 'active' };
      if (facility_id) {
        if (isNaN(facility_id)) {
          return res.status(400).json({ 
            message: 'Invalid facility ID' 
          });
        }
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

      // Transform resources for calendar
      const calendarResources = resources.map(resource => ({
        id: resource.resource_id.toString(),
        title: resource.resource_name,
        facility: resource.facility.facility_name,
        facilityId: resource.facility_id,
        facilityTimezone: resource.facility.facility_time_zone || TimezoneUtils.DEFAULT_TIMEZONE,
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

  // Get single episode details
  async getEpisodeById(req, res) {
    try {
      const { id } = req.params;
      const { timezone } = req.query;

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
      const facilityTimezone = facility.facility_time_zone || TimezoneUtils.DEFAULT_TIMEZONE;
      const displayTimezone = timezone || facilityTimezone;

      // Check if user has permission to view full details
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

      res.json({
        episode,
        canViewFullDetails,
        facilityTimezone,
        displayTimezone
      });

    } catch (error) {
      console.error('GET /api/episodes/:id error:', error);
      res.status(500).json({ 
        message: 'An error occurred while fetching episode',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Placeholder methods for completeness
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

// Helper function to get status color with admin adjustments
function getStatusColor(status, userType, episode = null) {
  const statusColors = {
    'available': '#FFFFFF',      // White: Unassigned
    'assigned': '#FFEB3B',       // Yellow: Assigned Pending
    'pending': '#FFEB3B',        // Yellow: Assigned Pending
    'booked': '#4CAF50',         // Green: Booked/Paid
    'maintenance': '#9E9E9E',    // Gray: Unavailable/Maintenance
    'cancelled': '#9E9E9E'       // Gray: Unavailable
  };
  
  // For admin view, assigned episodes that are reserved (not just pending) should be blue
  if (userType === 'admin' && status === 'assigned' && episode?.assigned_to_program_id) {
    return '#2196F3'; // Blue: Assigned Reserved
  }
  
  return statusColors[status] || '#FFFFFF';
}

// Helper function to check if episode can be edited
function canEditEpisode(episode, user) {
  if (!episode || !user) return false;
  
  // Only admins can edit for now
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