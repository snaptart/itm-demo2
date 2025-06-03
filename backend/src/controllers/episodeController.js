// backend/src/controllers/episodeController.js (Simplified - Local Time)
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
  // Get episodes - no timezone conversion needed
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
      
      // Date range filter - times are already in local timezone
      if (start && end) {
        const startDate = new Date(start);
        const endDate = new Date(end);
        
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          whereClause.episode_start_date_time = {
            [Op.between]: [startDate, endDate]
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

      // Format episodes for calendar - times are already in local timezone
      const calendarEvents = episodes.map(episode => {
        const facility = episode.event?.resource?.facility;
        
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

  // Get single episode
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

  // Validate episode move
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
          warnings: []
        });
      }

      // Check conflicts
      const conflictResult = await conflictDetectionService.checkEpisodeConflicts({
        episodeId: episode_id,
        resourceId: episode.event.resource_id,
        newStartTime: newStart,
        newEndTime: newEnd,
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

  // Move episode
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

      const newStartDate = new Date(new_start_time);
      const newEndDate = new Date(new_end_time);

      if (isNaN(newStartDate.getTime()) || isNaN(newEndDate.getTime())) {
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
                [Op.between]: [newStartDate, newEndDate]
              }
            },
            {
              episode_end_date_time: {
                [Op.between]: [newStartDate, newEndDate]
              }
            },
            {
              [Op.and]: [
                {
                  episode_start_date_time: {
                    [Op.lte]: newStartDate
                  }
                },
                {
                  episode_end_date_time: {
                    [Op.gte]: newEndDate
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

      // Calculate duration
      const duration = Math.round((newEndDate - newStartDate) / (1000 * 60));

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
          }
        ]
      });

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

  // Resize episode
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

      const newEndDate = new Date(new_end_time);
      
      if (isNaN(newEndDate.getTime())) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Invalid date format' 
        });
      }

      const startDate = new Date(episode.episode_start_date_time);
      
      if (newEndDate <= startDate) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'End time must be after start time' 
        });
      }

      // Calculate duration
      const duration = Math.round((newEndDate - startDate) / (1000 * 60));

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

// backend/src/controllers/episodeController.js - Update and Delete methods

  // Update episode
  async updateEpisode(req, res) {
    let transaction = null;
    
    try {
      const { id } = req.params;
      const {
        episode_title,
        episode_description,
        episode_price,
        episode_status,
        assigned_to_program_id
      } = req.body;

      console.log(`Updating episode ${id} with data:`, req.body);

      // Validate episode ID
      if (!id || isNaN(id)) {
        return res.status(400).json({ 
          message: 'Invalid episode ID' 
        });
      }

      // Check permission - Admin only
      if (req.user.user_type !== 'admin') {
        return res.status(403).json({ 
          message: 'Only administrators can update episodes' 
        });
      }

      // Start transaction
      transaction = await sequelize.transaction();

      // Get episode with associations
      const episode = await Episode.findByPk(id, {
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
            model: Booking,
            as: 'bookings',
            where: {
              booking_status: {
                [Op.in]: ['pending', 'approved']
              }
            },
            required: false
          }
        ],
        transaction
      });

      if (!episode) {
        await transaction.rollback();
        return res.status(404).json({ 
          message: 'Episode not found' 
        });
      }

      // Validation: Cannot update past episodes
      if (new Date(episode.episode_start_date_time) < new Date()) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Cannot update past episodes' 
        });
      }

      // Validation: Cannot update booked episodes
      if (episode.episode_status === 'booked') {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Cannot update booked episodes' 
        });
      }

      // Validation: Cannot update episodes with active bookings
      if (episode.bookings && episode.bookings.length > 0) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Cannot update episodes with active bookings' 
        });
      }

      // If assigning to a program, verify the program exists
      if (assigned_to_program_id) {
        const program = await Program.findByPk(assigned_to_program_id, { transaction });
        if (!program) {
          await transaction.rollback();
          return res.status(400).json({ 
            message: 'Invalid program ID' 
          });
        }
      }

      // Build update object
      const updateData = {
        updated_by: req.user.username
      };

      // Only update provided fields
      if (episode_title !== undefined) {
        updateData.episode_title = episode_title.trim();
      }
      if (episode_description !== undefined) {
        updateData.episode_description = episode_description.trim();
      }
      if (episode_price !== undefined) {
        updateData.episode_price = episode_price === '' ? null : parseFloat(episode_price);
      }
      if (episode_status !== undefined) {
        // Validate status transition
        const validStatuses = ['available', 'assigned', 'pending', 'booked', 'maintenance', 'cancelled'];
        if (!validStatuses.includes(episode_status)) {
          await transaction.rollback();
          return res.status(400).json({ 
            message: 'Invalid episode status' 
          });
        }
        updateData.episode_status = episode_status;
      }
      if (assigned_to_program_id !== undefined) {
        updateData.assigned_to_program_id = assigned_to_program_id || null;
        
        // If assigning to a program, update status to 'assigned' if currently 'available'
        if (assigned_to_program_id && episode.episode_status === 'available') {
          updateData.episode_status = 'assigned';
        }
        
        // If removing program assignment and status is 'assigned', revert to 'available'
        if (!assigned_to_program_id && episode.episode_status === 'assigned') {
          updateData.episode_status = 'available';
        }
      }

      // Update the episode
      await episode.update(updateData, { transaction });

      // Commit transaction
      await transaction.commit();

      console.log(`Successfully updated episode ${id}`);

      // Reload with all associations
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

      res.json({
        message: 'Episode updated successfully',
        episode: {
          ...updatedEpisode.toJSON(),
          facilityTimezone: updatedEpisode.event.resource.facility.facility_time_zone
        }
      });

    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      console.error('Update episode error:', error);
      res.status(500).json({ 
        message: 'An error occurred while updating the episode',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Delete episode
  async deleteEpisode(req, res) {
    let transaction = null;
    
    try {
      const { id } = req.params;

      console.log(`Deleting episode ${id}`);

      // Validate episode ID
      if (!id || isNaN(id)) {
        return res.status(400).json({ 
          message: 'Invalid episode ID' 
        });
      }

      // Check permission - Admin only
      if (req.user.user_type !== 'admin') {
        return res.status(403).json({ 
          message: 'Only administrators can delete episodes' 
        });
      }

      // Start transaction
      transaction = await sequelize.transaction();

      // Get episode with associations
      const episode = await Episode.findByPk(id, {
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
            model: Booking,
            as: 'bookings'
          }
        ],
        transaction
      });

      if (!episode) {
        await transaction.rollback();
        return res.status(404).json({ 
          message: 'Episode not found' 
        });
      }

      // Validation: Cannot delete past episodes
      if (new Date(episode.episode_start_date_time) < new Date()) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Cannot delete past episodes' 
        });
      }

      // Validation: Cannot delete booked episodes
      if (episode.episode_status === 'booked') {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Cannot delete booked episodes' 
        });
      }

      // Validation: Cannot delete episodes with any bookings
      if (episode.bookings && episode.bookings.length > 0) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Cannot delete episodes that have bookings. Please cancel all bookings first.' 
        });
      }

      // Check if this is the last episode for the event
      const otherEpisodes = await Episode.count({
        where: {
          event_id: episode.event_id,
          episode_id: { [Op.ne]: id }
        },
        transaction
      });

      // Delete the episode
      await episode.destroy({ transaction });

      // If this was the last episode, optionally delete the event
      // For now, we'll keep the event even if it has no episodes
      
      // Commit transaction
      await transaction.commit();

      console.log(`Successfully deleted episode ${id}`);

      res.json({
        message: 'Episode deleted successfully',
        deletedEpisodeId: parseInt(id)
      });

    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      console.error('Delete episode error:', error);
      res.status(500).json({ 
        message: 'An error occurred while deleting the episode',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
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