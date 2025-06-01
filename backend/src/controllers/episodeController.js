<!-- backend/src/controllers/episodeController.js -->
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
        backgroundColor: episode.getStatusColor(),
        borderColor: episode.getStatusColor(),
        textColor: episode.episode_status === 'available' ? '#000000' : '#FFFFFF',
        extendedProps: {
          episodeId: episode.episode_id,
          status: episode.episode_status,
          price: episode.getFormattedPrice(),
          duration: episode.episode_duration,
          facility: episode.event.resource.facility.facility_name,
          resource: episode.event.resource.resource_name,
          program: episode.program?.program_name || null,
          assignedProgram: episode.assignedProgram?.program_name || null,
          canBook: episode.canBeBooked(),
          description: episode.episode_description
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
  }
};

module.exports = episodeController; 