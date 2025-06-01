// backend/src/controllers/episodeController.js (Enhanced with Timezone and Drag-Drop)
const { Episode, Event, Resource, Facility, Program, Booking, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const TimezoneUtils = require('../utils/timezoneUtils');
const conflictDetectionService = require('../services/conflictDetectionService');
const businessRulesValidator = require('../utils/businessRulesValidator');

const episodeController = {
  // Get episodes for calendar view with timezone conversion
  async getEpisodes(req, res) {
    try {
      const { 
        start, 
        end, 
        facility_id, 
        resource_id, 
        status,
        program_id,
        timezone // Client timezone preference
      } = req.query;

      // Build where clause
      const whereClause = {};
      
      // Get facility for timezone context
      let facilityTimezone = TimezoneUtils.DEFAULT_TIMEZONE;
      if (facility_id) {
        const facility = await Facility.findByPk(facility_id);
        facilityTimezone = facility?.facility_time_zone || TimezoneUtils.DEFAULT_TIMEZONE;
      }

      // Date range filter with timezone conversion
      if (start && end) {
        const startDate = TimezoneUtils.parseAndConvertToUTC(start, timezone || facilityTimezone);
        const endDate = TimezoneUtils.parseAndConvertToUTC(end, timezone || facilityTimezone);
        
        if (!startDate || !endDate) {
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
        const startDate = TimezoneUtils.parseAndConvertToUTC(start, timezone || facilityTimezone);
        if (!startDate) {
          return res.status(400).json({ 
            message: 'Invalid start date format' 
          });
        }
        whereClause.episode_start_date_time = {
          [Op.gte]: startDate
        };
      } else if (end) {
        const endDate = TimezoneUtils.parseAndConvertToUTC(end, timezone || facilityTimezone);
        if (!endDate) {
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

      // Transform episodes for calendar view with timezone conversion
      const calendarEvents = episodes.map(episode => {
        const episodeFacilityTimezone = episode.event.resource.facility.facility_time_zone || facilityTimezone;
        const displayTimezone = timezone || episodeFacilityTimezone;

        return {
          id: episode.episode_id,
          title: episode.episode_title || 'Ice Time',
          start: episode.episode_start_date_time,
          end: episode.episode_end_date_time,
          resourceId: episode.event.resource_id,
          backgroundColor: getStatusColor(episode.episode_status, req.user.user_type, episode),
          borderColor: getStatusColor(episode.episode_status, req.user.user_type, episode),
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
            description: episode.episode_description,
            displayStartTime: TimezoneUtils.formatForDisplay(
              episode.episode_start_date_time, 
              displayTimezone, 
              'h:mm A z'
            ),
            displayEndTime: TimezoneUtils.formatForDisplay(
              episode.episode_end_date_time, 
              displayTimezone, 
              'h:mm A z'
            )
          }
        };
      });

      res.json({
        events: calendarEvents,
        total: episodes.length,
        timezone: facilityTimezone
      });

    } catch (error) {
      console.error('Get episodes error:', error);
      res.status(500).json({ 
        message: 'An error occurred while fetching episodes',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Validate episode move/resize with full conflict detection
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

      // Check business rules first
      const businessRules = await businessRulesValidator.validateEpisodeMove({
        episode,
        newStartTime: new_start_time,
        newEndTime: new_end_time,
        facilityId: actualFacilityId,
        userId: req.user.user_id
      });

      // If business rules fail, return those violations
      if (businessRules.violations.length > 0) {
        return res.json({
          valid: false,
          conflicts: businessRules.violations,
          warnings: businessRules.warnings,
          businessRuleViolations: businessRules.violations.map(v => v.description)
        });
      }

      // Check for scheduling conflicts
      const conflictResult = await conflictDetectionService.checkEpisodeConflicts({
        episodeId: episode_id,
        resourceId: episode.event.resource_id,
        newStartTime: new_start_time,
        newEndTime: new_end_time,
        facilityId: actualFacilityId
      });

      const isValid = conflictResult.conflicts.length === 0;

      res.json({
        valid: isValid,
        conflicts: conflictResult.conflicts,
        warnings: [...businessRules.warnings, ...conflictResult.warnings],
        businessRuleViolations: []
      });

    } catch (error) {
      console.error('Validate episode move error:', error);
      res.status(500).json({ 
        message: 'An error occurred while validating the move',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Move episode with full validation and timezone support
  async moveEpisode(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      const { new_start_time, new_end_time, new_duration } = req.body;

      // Validate required fields
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

      const facility = episode.event.resource.facility;
      const facilityTimezone = facility.facility_time_zone || TimezoneUtils.DEFAULT_TIMEZONE;

      // Check permission
      if (facility.admin_user_id !== req.user.user_id) {
        await transaction.rollback();
        return res.status(403).json({ 
          message: 'You do not have permission to move this episode' 
        });
      }

      // Validate move with business rules and conflicts
      const validation = await this.validateEpisodeMove({
        ...req,
        body: {
          episode_id: id,
          new_start_time,
          new_end_time,
          facility_id: facility.facility_id
        }
      }, { json: () => {} });

      if (!validation || !validation.valid) {
        await transaction.rollback();
        return res.status(400).json({
          message: 'Move validation failed',
          conflicts: validation?.conflicts || [],
          warnings: validation?.warnings || []
        });
      }

      // Convert times to UTC for storage
      const utcStartTime = TimezoneUtils.parseAndConvertToUTC(new_start_time, facilityTimezone);
      const utcEndTime = TimezoneUtils.parseAndConvertToUTC(new_end_time, facilityTimezone);

      // Calculate duration
      const duration = new_duration || TimezoneUtils.calculateDurationWithDST(
        utcStartTime, 
        utcEndTime, 
        facilityTimezone
      );

      // Update episode
      await episode.update({
        episode_start_date_time: utcStartTime,
        episode_end_date_time: utcEndTime,
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
        episode: TimezoneUtils.convertEpisodeTimesForAPI(updatedEpisode, facilityTimezone)
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

  // Resize episode with full validation and timezone support
  async resizeEpisode(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      const { new_end_time, new_duration } = req.body;

      // Validate required fields
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

      const facility = episode.event.resource.facility;
      const facilityTimezone = facility.facility_time_zone || TimezoneUtils.DEFAULT_TIMEZONE;

      // Check permission
      if (facility.admin_user_id !== req.user.user_id) {
        await transaction.rollback();
        return res.status(403).json({ 
          message: 'You do not have permission to resize this episode' 
        });
      }

      // Validate resize with business rules and conflicts
      const validation = await this.validateEpisodeMove({
        ...req,
        body: {
          episode_id: id,
          new_start_time: episode.episode_start_date_time,
          new_end_time,
          facility_id: facility.facility_id
        }
      }, { json: () => {} });

      if (!validation || !validation.valid) {
        await transaction.rollback();
        return res.status(400).json({
          message: 'Resize validation failed',
          conflicts: validation?.conflicts || [],
          warnings: validation?.warnings || []
        });
      }

      // Convert end time to UTC for storage
      const utcEndTime = TimezoneUtils.parseAndConvertToUTC(new_end_time, facilityTimezone);

      // Calculate duration
      const duration = new_duration || TimezoneUtils.calculateDurationWithDST(
        episode.episode_start_date_time, 
        utcEndTime, 
        facilityTimezone
      );

      // Update episode
      await episode.update({
        episode_end_date_time: utcEndTime,
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
        episode: TimezoneUtils.convertEpisodeTimesForAPI(updatedEpisode, facilityTimezone)
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

  // Validate batch moves with conflict detection
  async validateBatchMoves(req, res) {
    try {
      const { moves } = req.body;

      if (!Array.isArray(moves) || moves.length === 0) {
        return res.status(400).json({ 
          message: 'Moves array is required and cannot be empty' 
        });
      }

      // Get facility context for timezone
      let facilityId = null;
      if (moves.length > 0 && moves[0].facility_id) {
        facilityId = moves[0].facility_id;
      }

      // Validate business rules for each move
      const businessRulesResults = await businessRulesValidator.validateBatchMoves(moves, req.user.user_id);

      // Check for conflicts
      const conflictResults = await conflictDetectionService.checkBatchConflicts(moves, facilityId);

      // Combine results
      const results = moves.map((move, index) => {
        const businessRules = businessRulesResults[index] || { violations: [], warnings: [] };
        const conflicts = conflictResults[index] || { conflicts: [], warnings: [] };

        return {
          episode_id: move.episode_id,
          valid: businessRules.violations.length === 0 && conflicts.conflicts.length === 0,
          conflicts: [...businessRules.violations, ...conflicts.conflicts],
          warnings: [...businessRules.warnings, ...conflicts.warnings]
        };
      });

      const overallValid = results.every(r => r.valid);

      res.json({
        valid: overallValid,
        results,
        overallConflicts: results.flatMap(r => r.conflicts)
      });

    } catch (error) {
      console.error('Validate batch moves error:', error);
      res.status(500).json({ 
        message: 'An error occurred while validating batch moves',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Create new episode with timezone support
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
        episode_status,
        facility_timezone
      } = req.body;

      // Validate required fields
      if (!event_id || !episode_start_date_time || !episode_end_date_time) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Event ID, start time, and end time are required' 
        });
      }

      // Verify event exists and get facility context
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

      const facility = event.resource.facility;
      const facilityTimezone = facility_timezone || facility.facility_time_zone || TimezoneUtils.DEFAULT_TIMEZONE;

      // Check permission
      if (facility.admin_user_id !== req.user.user_id) {
        await transaction.rollback();
        return res.status(403).json({ 
          message: 'You do not have permission to create episodes for this facility' 
        });
      }

      // Convert times to UTC for storage
      const utcStartTime = TimezoneUtils.parseAndConvertToUTC(episode_start_date_time, facilityTimezone);
      const utcEndTime = TimezoneUtils.parseAndConvertToUTC(episode_end_date_time, facilityTimezone);

      if (!utcStartTime || !utcEndTime) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Invalid date format' 
        });
      }
      
      if (utcStartTime >= utcEndTime) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'End time must be after start time' 
        });
      }

      // Validate with conflict detection
      const conflictResult = await conflictDetectionService.checkEpisodeConflicts({
        episodeId: null, // New episode
        resourceId: event.resource_id,
        newStartTime: episode_start_date_time,
        newEndTime: episode_end_date_time,
        facilityId: facility.facility_id,
        skipSelf: false
      });

      if (conflictResult.conflicts.length > 0) {
        await transaction.rollback();
        return res.status(400).json({
          message: 'Schedule conflicts detected',
          conflicts: conflictResult.conflicts,
          warnings: conflictResult.warnings
        });
      }

      // Calculate duration
      const duration = TimezoneUtils.calculateDurationWithDST(utcStartTime, utcEndTime, facilityTimezone);

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
        episode_start_date_time: utcStartTime,
        episode_end_date_time: utcEndTime,
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
        episode: TimezoneUtils.convertEpisodeTimesForAPI(newEpisode, facilityTimezone)
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

  // Update episode with timezone support
  async updateEpisode(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;

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

      const facility = episode.event.resource.facility;
      const facilityTimezone = facility.facility_time_zone || TimezoneUtils.DEFAULT_TIMEZONE;

      // Check permission
      if (facility.admin_user_id !== req.user.user_id) {
        await transaction.rollback();
        return res.status(403).json({ 
          message: 'You do not have permission to update this episode' 
        });
      }

      // Check if episode can be edited
      if (!canEditEpisode(episode, req.user)) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'This episode cannot be edited' 
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

      // Handle datetime updates with timezone conversion
      if (req.body.episode_start_date_time !== undefined) {
        const utcStartTime = TimezoneUtils.parseAndConvertToUTC(req.body.episode_start_date_time, facilityTimezone);
        if (!utcStartTime) {
          await transaction.rollback();
          return res.status(400).json({ 
            message: 'Invalid start time format' 
          });
        }
        updateData.episode_start_date_time = utcStartTime;
      }

      if (req.body.episode_end_date_time !== undefined) {
        const utcEndTime = TimezoneUtils.parseAndConvertToUTC(req.body.episode_end_date_time, facilityTimezone);
        if (!utcEndTime) {
          await transaction.rollback();
          return res.status(400).json({ 
            message: 'Invalid end time format' 
          });
        }
        updateData.episode_end_date_time = utcEndTime;
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

        updateData.episode_duration = TimezoneUtils.calculateDurationWithDST(startTime, endTime, facilityTimezone);
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
        episode: TimezoneUtils.convertEpisodeTimesForAPI(updatedEpisode, facilityTimezone)
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

  // Get single episode details with timezone conversion
  async getEpisodeById(req, res) {
    try {
      const { id } = req.params;
      const { timezone } = req.query; // Client timezone preference

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
        episode: TimezoneUtils.convertEpisodeTimesForAPI(episode, displayTimezone),
        canViewFullDetails,
        facilityTimezone,
        displayTimezone
      });

    } catch (error) {
      console.error('Get episode error:', error);
      res.status(500).json({ 
        message: 'An error occurred while fetching episode',
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
      console.error('Get calendar resources error:', error);
      res.status(500).json({ 
        message: 'An error occurred while fetching calendar resources',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
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
  if (TimezoneUtils.convertToFacilityTime(episode.episode_start_date_time).isBefore(TimezoneUtils.getCurrentTime())) {
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