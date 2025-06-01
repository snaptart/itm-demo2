// backend/src/controllers/episodeController.js (Fixed with proper drag-drop implementation)
const { Episode, Event, Resource, Facility, Program, Booking, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

const episodeController = {
  // Get episodes for calendar view
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

      // Build where clause
      const whereClause = {};
      
      // Date range filter with validation
      if (start && end) {
        const startDate = new Date(start);
        const endDate = new Date(end);
        
        if (isNaN(startDate) || isNaN(endDate)) {
          return res.status(400).json({ 
            message: 'Invalid date format' 
          });
        }
        
        if (startDate > endDate) {
          return res.status(400).json({ 
            message: 'Start date must be before end date' 
          });
        }
        
        whereClause.episode_start_date_time = {
          [Op.between]: [startDate, endDate]
        };
      } else if (start) {
        const startDate = new Date(start);
        if (isNaN(startDate)) {
          return res.status(400).json({ 
            message: 'Invalid start date format' 
          });
        }
        whereClause.episode_start_date_time = {
          [Op.gte]: startDate
        };
      } else if (end) {
        const endDate = new Date(end);
        if (isNaN(endDate)) {
          return res.status(400).json({ 
            message: 'Invalid end date format' 
          });
        }
        whereClause.episode_start_date_time = {
          [Op.lte]: endDate
        };
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

      // For schedulers, filter to show only available slots or their program's slots
      if (req.user.user_type === 'scheduler') {
        // Get user's programs
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
          // If scheduler has no programs, only show available slots
          whereClause.episode_status = 'available';
        }
      }

      const episodes = await Episode.findAll({
        where: whereClause,
        include: includeArray,
        order: [['episode_start_date_time', 'ASC']],
        limit: 1000 // Limit results to prevent performance issues
      });

      // Transform episodes for calendar view
      const calendarEvents = episodes.map(episode => ({
        id: episode.episode_id,
        title: episode.episode_title || 'Ice Time',
        start: episode.episode_start_date_time,
        end: episode.episode_end_date_time,
        resourceId: episode.event.resource_id,
        backgroundColor: getStatusColor(episode.episode_status),
        borderColor: getStatusColor(episode.episode_status),
        textColor: episode.episode_status === 'available' ? '#000000' : '#FFFFFF',
        extendedProps: {
          episodeId: episode.episode_id,
          status: episode.episode_status,
          price: episode.episode_price ? `$${parseFloat(episode.episode_price).toFixed(2)}` : 'N/A',
          duration: episode.episode_duration,
          facility: episode.event.resource.facility.facility_name,
          resource: episode.event.resource.resource_name,
          program: episode.program?.program_name || null,
          assignedProgram: episode.assignedProgram?.program_name || null,
          canBook: ['available', 'assigned'].includes(episode.episode_status),
          description: episode.episode_description,
          hasBookings: episode.bookings && episode.bookings.length > 0
        }
      }));

      res.json({
        events: calendarEvents,
        total: episodes.length
      });

    } catch (error) {
      console.error('Get episodes error:', error);
      res.status(500).json({ 
        message: 'An error occurred while fetching episodes',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Get single episode details
  async getEpisodeById(req, res) {
    try {
      const { id } = req.params;

      // Validate ID
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
        canViewFullDetails
      });

    } catch (error) {
      console.error('Get episode error:', error);
      res.status(500).json({ 
        message: 'An error occurred while fetching episode',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Create new episode (Admin only)
  async createEpisode(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const {
        event_id,
        episode_start_date_time,
        episode_end_date_time,
        episode_title,
        episode_description,
        episode_price,
        episode_status
      } = req.body;

      // Validate required fields
      if (!event_id || !episode_start_date_time || !episode_end_date_time) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Event ID, start time, and end time are required' 
        });
      }

      // Validate dates
      const startTime = new Date(episode_start_date_time);
      const endTime = new Date(episode_end_date_time);
      
      if (isNaN(startTime) || isNaN(endTime)) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Invalid date format' 
        });
      }
      
      if (startTime >= endTime) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'End time must be after start time' 
        });
      }
      
      if (startTime < new Date()) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Cannot create episodes in the past' 
        });
      }

      // Verify event exists
      const event = await Event.findByPk(event_id, {
        include: [{
          model: Resource,
          as: 'resource',
          include: [{
            model: Facility,
            as: 'facility'
          }]
        }],
        transaction
      });

      if (!event) {
        await transaction.rollback();
        return res.status(404).json({ 
          message: 'Event not found' 
        });
      }

      // Check permission
      if (event.resource.facility.admin_user_id !== req.user.user_id) {
        await transaction.rollback();
        return res.status(403).json({ 
          message: 'You do not have permission to create episodes for this facility' 
        });
      }

      // Check for overlapping episodes
      const overlappingEpisode = await Episode.findOne({
        where: {
          event_id,
          [Op.or]: [
            {
              episode_start_date_time: {
                [Op.between]: [startTime, endTime]
              }
            },
            {
              episode_end_date_time: {
                [Op.between]: [startTime, endTime]
              }
            },
            {
              [Op.and]: [
                {
                  episode_start_date_time: {
                    [Op.lte]: startTime
                  }
                },
                {
                  episode_end_date_time: {
                    [Op.gte]: endTime
                  }
                }
              ]
            }
          ]
        },
        transaction
      });

      if (overlappingEpisode) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'An episode already exists for this time slot' 
        });
      }

      // Calculate duration
      const duration = Math.round((endTime - startTime) / (1000 * 60)); // in minutes

      // Validate price
      let validatedPrice = null;
      if (episode_price !== undefined && episode_price !== null && episode_price !== '') {
        validatedPrice = parseFloat(episode_price);
        if (isNaN(validatedPrice) || validatedPrice < 0) {
          await transaction.rollback();
          return res.status(400).json({ 
            message: 'Invalid price value' 
          });
        }
      }

      const episode = await Episode.create({
        event_id,
        episode_start_date_time: startTime,
        episode_end_date_time: endTime,
        episode_duration: duration,
        episode_title: episode_title?.trim() || `Ice Time - ${event.resource.resource_name}`,
        episode_description: episode_description?.trim(),
        episode_price: validatedPrice,
        episode_status: episode_status || 'available',
        created_by: req.user.username,
        updated_by: req.user.username
      }, { transaction });

      await transaction.commit();

      // Reload with associations
      const newEpisode = await Episode.findByPk(episode.episode_id, {
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

      res.status(201).json({
        message: 'Episode created successfully',
        episode: newEpisode
      });

    } catch (error) {
      await transaction.rollback();
      console.error('Create episode error:', error);
      res.status(500).json({ 
        message: 'An error occurred while creating episode',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Update episode (Admin only)
  async updateEpisode(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;

      // Validate ID
      if (!id || isNaN(id)) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Invalid episode ID' 
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

      // Check permission
      if (episode.event.resource.facility.admin_user_id !== req.user.user_id) {
        await transaction.rollback();
        return res.status(403).json({ 
          message: 'You do not have permission to update this episode' 
        });
      }

      // Check if episode can be edited
      if (episode.episode_status === 'booked') {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Cannot edit booked episodes' 
        });
      }

      if (new Date(episode.episode_start_date_time) < new Date()) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Cannot edit past episodes' 
        });
      }

      // Validate update data
      const updateData = {};
      
      if (req.body.episode_title !== undefined) {
        updateData.episode_title = req.body.episode_title?.trim();
        if (!updateData.episode_title) {
          await transaction.rollback();
          return res.status(400).json({ 
            message: 'Episode title cannot be empty' 
          });
        }
      }
      
      if (req.body.episode_description !== undefined) {
        updateData.episode_description = req.body.episode_description?.trim();
      }
      
      if (req.body.episode_price !== undefined) {
        if (req.body.episode_price === '' || req.body.episode_price === null) {
          updateData.episode_price = null;
        } else {
          const price = parseFloat(req.body.episode_price);
          if (isNaN(price) || price < 0) {
            await transaction.rollback();
            return res.status(400).json({ 
              message: 'Invalid price value' 
            });
          }
          updateData.episode_price = price;
        }
      }
      
      if (req.body.episode_status !== undefined) {
        const validStatuses = ['available', 'assigned', 'pending', 'booked', 'maintenance', 'cancelled'];
        if (!validStatuses.includes(req.body.episode_status)) {
          await transaction.rollback();
          return res.status(400).json({ 
            message: 'Invalid episode status' 
          });
        }
        updateData.episode_status = req.body.episode_status;
      }

      // Handle datetime updates for drag-drop operations
      if (req.body.episode_start_date_time !== undefined) {
        const newStartTime = new Date(req.body.episode_start_date_time);
        if (isNaN(newStartTime)) {
          await transaction.rollback();
          return res.status(400).json({ 
            message: 'Invalid start date format' 
          });
        }
        updateData.episode_start_date_time = newStartTime;
      }

      if (req.body.episode_end_date_time !== undefined) {
        const newEndTime = new Date(req.body.episode_end_date_time);
        if (isNaN(newEndTime)) {
          await transaction.rollback();
          return res.status(400).json({ 
            message: 'Invalid end date format' 
          });
        }
        updateData.episode_end_date_time = newEndTime;
      }

      // Recalculate duration if times changed
      if (updateData.episode_start_date_time || updateData.episode_end_date_time) {
        const startTime = updateData.episode_start_date_time || episode.episode_start_date_time;
        const endTime = updateData.episode_end_date_time || episode.episode_end_date_time;
        
        if (startTime >= endTime) {
          await transaction.rollback();
          return res.status(400).json({ 
            message: 'End time must be after start time' 
          });
        }

        updateData.episode_duration = Math.round((endTime - startTime) / (1000 * 60));
      }

      updateData.updated_by = req.user.username;

      // Update episode
      await episode.update(updateData, { transaction });

      await transaction.commit();

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
        message: 'Episode updated successfully',
        episode: updatedEpisode
      });

    } catch (error) {
      await transaction.rollback();
      console.error('Update episode error:', error);
      res.status(500).json({ 
        message: 'An error occurred while updating episode',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Delete episode (Admin only)
  async deleteEpisode(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;

      // Validate ID
      if (!id || isNaN(id)) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Invalid episode ID' 
        });
      }

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

      // Check permission
      if (episode.event.resource.facility.admin_user_id !== req.user.user_id) {
        await transaction.rollback();
        return res.status(403).json({ 
          message: 'You do not have permission to delete this episode' 
        });
      }

      // Check if episode has bookings
      if (episode.bookings && episode.bookings.length > 0) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Cannot delete episode with existing bookings' 
        });
      }

      // Check if episode is booked
      if (episode.episode_status === 'booked') {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Cannot delete booked episodes' 
        });
      }

      await episode.destroy({ transaction });
      await transaction.commit();

      res.json({ 
        message: 'Episode deleted successfully' 
      });

    } catch (error) {
      await transaction.rollback();
      console.error('Delete episode error:', error);
      res.status(500).json({ 
        message: 'An error occurred while deleting episode',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Get calendar resources (facilities and their rinks)
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
          attributes: ['facility_id', 'facility_name']
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
      console.error('Get calendar resources error:', error);
      res.status(500).json({ 
        message: 'An error occurred while fetching calendar resources',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Validate episode move/resize
  async validateEpisodeMove(req, res) {
    try {
      const { 
        episode_id, 
        new_start_time, 
        new_end_time, 
        facility_id 
      } = req.body;

      // Validate required fields
      if (!episode_id || !new_start_time || !new_end_time) {
        return res.status(400).json({ 
          message: 'Episode ID, new start time, and new end time are required' 
        });
      }

      // Get the episode to validate
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
      });

      if (!episode) {
        return res.status(404).json({ 
          message: 'Episode not found' 
        });
      }

      // Check permission
      if (episode.event.resource.facility.admin_user_id !== req.user.user_id) {
        return res.status(403).json({ 
          message: 'You do not have permission to move this episode' 
        });
      }

      // Basic validation
      const newStart = new Date(new_start_time);
      const newEnd = new Date(new_end_time);
      
      if (isNaN(newStart) || isNaN(newEnd)) {
        return res.status(400).json({ 
          message: 'Invalid date format' 
        });
      }
      
      if (newStart >= newEnd) {
        return res.status(400).json({ 
          message: 'End time must be after start time' 
        });
      }

      if (newStart < new Date()) {
        return res.status(400).json({ 
          message: 'Cannot move episode to the past' 
        });
      }

      const conflicts = [];
      const warnings = [];

      // Check if episode can be moved
      if (episode.episode_status === 'booked') {
        conflicts.push({
          type: 'booked_episode',
          severity: 'error',
          title: 'Booked Episode',
          description: 'Cannot move episodes that are already booked'
        });
      }

      if (new Date(episode.episode_start_date_time) < new Date()) {
        conflicts.push({
          type: 'past_episode',
          severity: 'error',
          title: 'Past Episode',
          description: 'Cannot move episodes that have already started'
        });
      }

      // Check for overlapping episodes on the same resource
      const overlappingEpisode = await Episode.findOne({
        where: {
          episode_id: { [Op.ne]: episode_id },
          [Op.or]: [
            {
              episode_start_date_time: {
                [Op.between]: [newStart, newEnd]
              }
            },
            {
              episode_end_date_time: {
                [Op.between]: [newStart, newEnd]
              }
            },
            {
              [Op.and]: [
                {
                  episode_start_date_time: {
                    [Op.lte]: newStart
                  }
                },
                {
                  episode_end_date_time: {
                    [Op.gte]: newEnd
                  }
                }
              ]
            }
          ]
        },
        include: [{
          model: Event,
          as: 'event',
          where: { resource_id: episode.event.resource_id },
          required: true
        }]
      });

      if (overlappingEpisode) {
        conflicts.push({
          type: 'overlap',
          severity: 'error',
          title: 'Schedule Overlap',
          description: `Conflicts with existing ice time: ${overlappingEpisode.episode_title}`,
          time: `${overlappingEpisode.episode_start_date_time.toLocaleString()} - ${overlappingEpisode.episode_end_date_time.toLocaleString()}`
        });
      }

      // Check business hours (basic validation)
      const facility = episode.event.resource.facility;
      const dailyStart = facility.facility_daily_start_time || '06:00:00';
      const dailyEnd = facility.facility_daily_end_time || '23:00:00';
      
      const startTimeStr = newStart.toTimeString().slice(0, 8);
      const endTimeStr = newEnd.toTimeString().slice(0, 8);

      if (startTimeStr < dailyStart || endTimeStr > dailyEnd) {
        conflicts.push({
          type: 'business_hours',
          severity: 'error',
          title: 'Outside Business Hours',
          description: `Facility hours are ${dailyStart} - ${dailyEnd}`,
          time: `${new_start_time} - ${new_end_time}`
        });
      }

      // Duration validation
      const duration = Math.round((newEnd - newStart) / (1000 * 60));
      if (duration < 30) {
        conflicts.push({
          type: 'duration_too_short',
          severity: 'error',
          title: 'Duration Too Short',
          description: 'Ice time must be at least 30 minutes long'
        });
      }

      if (duration > 480) {
        conflicts.push({
          type: 'duration_too_long',
          severity: 'error',
          title: 'Duration Too Long',
          description: 'Ice time cannot exceed 8 hours'
        });
      }

      // Warning for very long durations
      if (duration > 240 && duration <= 480) {
        warnings.push({
          type: 'duration_long',
          severity: 'warning',
          title: 'Long Duration',
          description: 'This is a very long ice time slot'
        });
      }

      res.json({
        valid: conflicts.length === 0,
        conflicts,
        warnings,
        businessRuleViolations: conflicts.map(c => c.description)
      });

    } catch (error) {
      console.error('Validate episode move error:', error);
      res.status(500).json({ 
        message: 'An error occurred while validating the move'
      });
    }
  },

  // Move episode
  async moveEpisode(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      const { new_start_time, new_end_time, new_duration } = req.body;

      // Validate input
      if (!new_start_time || !new_end_time) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'New start time and end time are required' 
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

      // Check permission
      if (episode.event.resource.facility.admin_user_id !== req.user.user_id) {
        await transaction.rollback();
        return res.status(403).json({ 
          message: 'You do not have permission to move this episode' 
        });
      }

      // Validate dates
      const newStart = new Date(new_start_time);
      const newEnd = new Date(new_end_time);
      
      if (isNaN(newStart) || isNaN(newEnd)) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Invalid date format' 
        });
      }

      if (newStart >= newEnd) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'End time must be after start time' 
        });
      }

      if (newStart < new Date()) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Cannot move episode to the past' 
        });
      }

      // Check if episode can be moved
      if (episode.episode_status === 'booked') {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Cannot move booked episodes' 
        });
      }

      if (new Date(episode.episode_start_date_time) < new Date()) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Cannot move episodes that have already started' 
        });
      }

      // Calculate new duration
      const duration = new_duration || Math.round((newEnd - newStart) / (1000 * 60));

      // Update the episode
      await episode.update({
        episode_start_date_time: newStart,
        episode_end_date_time: newEnd,
        episode_duration: duration,
        updated_by: req.user.username
      }, { transaction });

      await transaction.commit();

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
        episode: updatedEpisode
      });

    } catch (error) {
      await transaction.rollback();
      console.error('Move episode error:', error);
      res.status(500).json({ 
        message: 'An error occurred while moving the episode',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Resize episode
  async resizeEpisode(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      const { new_end_time, new_duration } = req.body;

      // Validate input
      if (!new_end_time) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'New end time is required' 
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

      // Check permission
      if (episode.event.resource.facility.admin_user_id !== req.user.user_id) {
        await transaction.rollback();
        return res.status(403).json({ 
          message: 'You do not have permission to resize this episode' 
        });
      }

      // Validate new end time
      const newEnd = new Date(new_end_time);
      const startTime = new Date(episode.episode_start_date_time);
      
      if (isNaN(newEnd)) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Invalid end time format' 
        });
      }

      if (newEnd <= startTime) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'End time must be after start time' 
        });
      }

      // Check if episode can be resized
      if (episode.episode_status === 'booked') {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Cannot resize booked episodes' 
        });
      }

      if (startTime < new Date()) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Cannot resize episodes that have already started' 
        });
      }

      // Calculate new duration
      const duration = new_duration || Math.round((newEnd - startTime) / (1000 * 60));

      // Validate duration
      if (duration < 30) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Ice time must be at least 30 minutes long' 
        });
      }

      if (duration > 480) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Ice time cannot exceed 8 hours' 
        });
      }

      // Update the episode
      await episode.update({
        episode_end_date_time: newEnd,
        episode_duration: duration,
        updated_by: req.user.username
      }, { transaction });

      await transaction.commit();

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
      console.error('Resize episode error:', error);
      res.status(500).json({ 
        message: 'An error occurred while resizing the episode',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Validate batch moves
  async validateBatchMoves(req, res) {
    try {
      const { moves } = req.body;

      if (!Array.isArray(moves) || moves.length === 0) {
        return res.status(400).json({ 
          message: 'Moves array is required and cannot be empty' 
        });
      }

      const results = [];

      for (const move of moves) {
        const { episode_id, new_start_time, new_end_time } = move;
        
        // Validate each move individually
        const validationResult = await episodeController.validateEpisodeMove({
          body: { episode_id, new_start_time, new_end_time },
          user: req.user
        });

        results.push({
          episode_id,
          valid: validationResult.valid || false,
          conflicts: validationResult.conflicts || [],
          warnings: validationResult.warnings || []
        });
      }

      // Check for cross-episode conflicts
      const overallConflicts = [];
      
      // Simple check for time overlaps between moved episodes
      for (let i = 0; i < moves.length - 1; i++) {
        for (let j = i + 1; j < moves.length; j++) {
          const move1 = moves[i];
          const move2 = moves[j];
          
          const start1 = new Date(move1.new_start_time);
          const end1 = new Date(move1.new_end_time);
          const start2 = new Date(move2.new_start_time);
          const end2 = new Date(move2.new_end_time);
          
          // Check if they overlap
          if (start1 < end2 && start2 < end1) {
            overallConflicts.push({
              type: 'batch_overlap',
              episodes: [move1.episode_id, move2.episode_id],
              description: `Episodes ${move1.episode_id} and ${move2.episode_id} would overlap after moving`
            });
          }
        }
      }

      const allValid = results.every(r => r.valid) && overallConflicts.length === 0;

      res.json({
        valid: allValid,
        results,
        overallConflicts
      });

    } catch (error) {
      console.error('Validate batch moves error:', error);
      res.status(500).json({ 
        message: 'An error occurred while validating batch moves'
      });
    }
  }
};

// Helper function to get status color
function getStatusColor(status) {
  const statusColors = {
    'available': '#FFFFFF',      // White: Unassigned
    'assigned': '#FFEB3B',       // Yellow: Assigned Pending
    'pending': '#FFEB3B',        // Yellow: Assigned Pending
    'booked': '#4CAF50',         // Green: Booked/Paid
    'maintenance': '#9E9E9E',    // Gray: Unavailable/Maintenance
    'cancelled': '#9E9E9E'       // Gray: Unavailable
  };
  
  return statusColors[status] || '#FFFFFF';
}

module.exports = episodeController;