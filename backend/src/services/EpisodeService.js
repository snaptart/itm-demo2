// backend/src/services/EpisodeService.js
const BaseService = require('./BaseService');
const EpisodeRepository = require('../repositories/EpisodeRepository');
const { ValidationError, NotFoundError, ConflictError, AuthorizationError, BusinessRuleError } = require('../utils/errors');
const conflictDetectionService = require('./conflictDetectionService');
const businessRulesValidator = require('../utils/businessRulesValidator');
const logger = require('../utils/logger');

class EpisodeService extends BaseService {
  constructor() {
    super(new EpisodeRepository());
  }

  /**
   * Get episodes for calendar view
   * @param {Object} filters - Filter criteria
   * @param {Object} user - User context
   * @returns {Promise<Array>} - Formatted calendar events
   */
  async getEpisodesForCalendar(filters, user) {
    return await this.executeOperation(async () => {
      const episodes = await this.repository.findForCalendar({
        ...filters,
        user_id: user.user_id,
        user_type: user.user_type
      });

      return episodes.map(episode => this.formatEpisodeForCalendar(episode, user));
    }, { operation: 'getEpisodesForCalendar', user: user.username, filters });
  }

  /**
   * Get episode by ID with full details
   * @param {number} id - Episode ID
   * @param {Object} user - User context
   * @returns {Promise<Object>} - Episode with details
   */
  async getEpisodeById(id, user) {
    return await this.executeOperation(async () => {
      this.validateRequired({ id }, ['id']);

      const episode = await this.repository.findWithDetails(id);
      if (!episode) {
        throw new NotFoundError('Episode not found');
      }

      // Check permissions for full details
      const canViewFullDetails = this.canUserViewFullDetails(episode, user);

      return {
        episode: {
          ...episode.toJSON(),
          facilityTimezone: episode.event.resource.facility.facility_time_zone
        },
        canViewFullDetails,
        canEdit: await this.repository.canBeEdited(id, user)
      };
    }, { operation: 'getEpisodeById', episodeId: id, user: user.username });
  }

  /**
   * Validate episode move operation
   * @param {Object} moveData - Move operation data
   * @param {Object} user - User context
   * @returns {Promise<Object>} - Validation result
   */
  async validateEpisodeMove(moveData, user) {
    return await this.executeOperation(async () => {
      const { episode_id, new_start_time, new_end_time, facility_id } = moveData;

      this.validateRequired(moveData, ['episode_id', 'new_start_time', 'new_end_time']);
      this.validatePermissions(user, 'admin');

      const episode = await this.repository.findWithDetails(episode_id);
      if (!episode) {
        throw new NotFoundError('Episode not found');
      }

      const newStart = new Date(new_start_time);
      const newEnd = new Date(new_end_time);

      if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
        return {
          valid: false,
          conflicts: [{
            type: 'invalid_date',
            severity: 'error',
            title: 'Invalid Date',
            description: 'Invalid date format provided'
          }],
          warnings: []
        };
      }

      this.validateDateRange(newStart, newEnd);

      // Check for schedule conflicts
      const conflictResult = await conflictDetectionService.checkEpisodeConflicts({
        episodeId: episode_id,
        resourceId: episode.event.resource_id,
        newStartTime: newStart,
        newEndTime: newEnd,
        facilityId: facility_id || episode.event.resource.facility_id
      });

      // Check business rules
      const businessRules = await businessRulesValidator.validateEpisodeMove({
        episode,
        newStartTime: newStart,
        newEndTime: newEnd,
        facilityId: facility_id || episode.event.resource.facility_id,
        userId: user.user_id
      });

      return {
        valid: conflictResult.conflicts.length === 0 && businessRules.violations.length === 0,
        conflicts: [...conflictResult.conflicts, ...businessRules.violations],
        warnings: [...conflictResult.warnings, ...businessRules.warnings]
      };
    }, { operation: 'validateEpisodeMove', episodeId: moveData.episode_id, user: user.username });
  }

  /**
   * Move episode to new time slot
   * @param {number} id - Episode ID
   * @param {Object} moveData - Move operation data
   * @param {Object} user - User context
   * @returns {Promise<Object>} - Updated episode
   */
  async moveEpisode(id, moveData, user) {
    return await this.executeOperation(async () => {
      const { new_start_time, new_end_time } = moveData;

      this.validateRequired({ id, new_start_time, new_end_time }, ['id', 'new_start_time', 'new_end_time']);
      this.validatePermissions(user, 'admin');

      const episode = await this.repository.findWithDetails(id);
      if (!episode) {
        throw new NotFoundError('Episode not found');
      }

      // Check if episode can be edited
      const canEdit = await this.repository.canBeEdited(id, user);
      if (!canEdit) {
        throw new BusinessRuleError('Episode cannot be moved');
      }

      const newStartDate = new Date(new_start_time);
      const newEndDate = new Date(new_end_time);

      this.validateDateRange(newStartDate, newEndDate);
      this.validateBusinessHours(newStartDate, newEndDate, episode.event.resource.facility);

      // Check for conflicts
      const conflicts = await this.repository.findConflicting(
        id,
        episode.event.resource_id,
        newStartDate,
        newEndDate
      );

      if (conflicts.length > 0) {
        throw new ConflictError('Move would create schedule conflicts', {
          conflicts: conflicts.map(c => ({
            episodeId: c.episode_id,
            title: c.episode_title,
            start: c.episode_start_date_time,
            end: c.episode_end_date_time
          }))
        });
      }

      // Perform the move
      const updatedEpisode = await this.repository.updateTimes(
        id,
        newStartDate,
        newEndDate,
        user.username
      );

      // Reload with associations
      const reloadedEpisode = await this.repository.findWithDetails(id);

      logger.business('Episode moved', {
        episodeId: id,
        oldStart: episode.episode_start_date_time,
        oldEnd: episode.episode_end_date_time,
        newStart: new_start_time,
        newEnd: new_end_time,
        duration: reloadedEpisode.episode_duration,
        facility: episode.event.resource.facility.facility_name,
        resource: episode.event.resource.resource_name
      });

      return {
        episode: {
          ...reloadedEpisode.toJSON(),
          facilityTimezone: reloadedEpisode.event.resource.facility.facility_time_zone
        }
      };
    }, { operation: 'moveEpisode', episodeId: id, user: user.username });
  }

  /**
   * Resize episode (change end time)
   * @param {number} id - Episode ID
   * @param {Object} resizeData - Resize operation data
   * @param {Object} user - User context
   * @returns {Promise<Object>} - Updated episode
   */
  async resizeEpisode(id, resizeData, user) {
    return await this.executeOperation(async () => {
      const { new_end_time } = resizeData;

      this.validateRequired({ id, new_end_time }, ['id', 'new_end_time']);
      this.validatePermissions(user, 'admin');

      const episode = await this.repository.findWithDetails(id);
      if (!episode) {
        throw new NotFoundError('Episode not found');
      }

      const canEdit = await this.repository.canBeEdited(id, user);
      if (!canEdit) {
        throw new BusinessRuleError('Episode cannot be resized');
      }

      const newEndDate = new Date(new_end_time);
      const startDate = new Date(episode.episode_start_date_time);

      if (isNaN(newEndDate.getTime())) {
        throw new ValidationError('Invalid date format');
      }

      if (newEndDate <= startDate) {
        throw new ValidationError('End time must be after start time');
      }

      const duration = Math.round((newEndDate - startDate) / (1000 * 60));

      if (duration < 30) {
        throw new ValidationError('Duration must be at least 30 minutes');
      }

      if (duration > 480) {
        throw new ValidationError('Duration cannot exceed 8 hours');
      }

      // Update the episode
      const updatedEpisode = await this.repository.updateById(id, {
        episode_end_date_time: newEndDate,
        episode_duration: duration,
        updated_by: user.username
      });

      // Reload with associations
      const reloadedEpisode = await this.repository.findWithDetails(id);

      logger.business('Episode resized', {
        episodeId: id,
        oldEnd: episode.episode_end_date_time,
        newEnd: new_end_time,
        newDuration: duration,
        facility: episode.event.resource.facility.facility_name,
        resource: episode.event.resource.resource_name
      });

      return {
        episode: {
          ...reloadedEpisode.toJSON(),
          facilityTimezone: reloadedEpisode.event.resource.facility.facility_time_zone
        }
      };
    }, { operation: 'resizeEpisode', episodeId: id, user: user.username });
  }

  /**
   * Update episode details
   * @param {number} id - Episode ID
   * @param {Object} updateData - Update data
   * @param {Object} user - User context
   * @returns {Promise<Object>} - Updated episode
   */
  async updateEpisode(id, updateData, user) {
    return await this.executeOperation(async () => {
      this.validateRequired({ id }, ['id']);
      this.validatePermissions(user, 'admin');

      const episode = await this.repository.findWithDetails(id);
      if (!episode) {
        throw new NotFoundError('Episode not found');
      }

      const canEdit = await this.repository.canBeEdited(id, user);
      if (!canEdit) {
        throw new BusinessRuleError('Episode cannot be updated');
      }

      // Validate update data
      const allowedFields = [
        'episode_title',
        'episode_description',
        'episode_price',
        'episode_status',
        'assigned_to_program_id'
      ];

      const updateFields = {};
      for (const field of allowedFields) {
        if (updateData.hasOwnProperty(field)) {
          updateFields[field] = updateData[field];
        }
      }

      // Validate status transition
      if (updateFields.episode_status) {
        this.validateStatusTransition(episode.episode_status, updateFields.episode_status);
      }

      // Handle program assignment logic
      if (updateFields.hasOwnProperty('assigned_to_program_id')) {
        await this.handleProgramAssignment(episode, updateFields, user);
      }

      updateFields.updated_by = user.username;

      // Perform update
      const updatedEpisode = await this.repository.updateById(id, updateFields);

      // Reload with associations
      const reloadedEpisode = await this.repository.findWithDetails(id);

      logger.business('Episode updated', {
        episodeId: id,
        changes: Object.keys(updateFields),
        facility: episode.event.resource.facility.facility_name,
        resource: episode.event.resource.resource_name
      });

      return {
        episode: {
          ...reloadedEpisode.toJSON(),
          facilityTimezone: reloadedEpisode.event.resource.facility.facility_time_zone
        }
      };
    }, { operation: 'updateEpisode', episodeId: id, user: user.username });
  }

  /**
   * Delete episode
   * @param {number} id - Episode ID
   * @param {Object} user - User context
   * @returns {Promise<Object>} - Deletion result
   */
  async deleteEpisode(id, user) {
    return await this.executeOperation(async () => {
      this.validateRequired({ id }, ['id']);
      this.validatePermissions(user, 'admin');

      const episode = await this.repository.findWithDetails(id);
      if (!episode) {
        throw new NotFoundError('Episode not found');
      }

      // Validate deletion constraints
      if (new Date(episode.episode_start_date_time) < new Date()) {
        throw new BusinessRuleError('Cannot delete past episodes');
      }

      if (episode.episode_status === 'booked') {
        throw new BusinessRuleError('Cannot delete booked episodes');
      }

      if (episode.bookings && episode.bookings.length > 0) {
        throw new BusinessRuleError('Cannot delete episodes that have bookings. Please cancel all bookings first.');
      }

      // Perform deletion
      await this.repository.deleteById(id);

      logger.business('Episode deleted', {
        episodeId: id,
        title: episode.episode_title,
        startTime: episode.episode_start_date_time,
        facility: episode.event.resource.facility.facility_name,
        resource: episode.event.resource.resource_name
      });

      return { deletedEpisodeId: parseInt(id) };
    }, { operation: 'deleteEpisode', episodeId: id, user: user.username });
  }

  /**
   * Get calendar resources for facility
   * @param {number} facilityId - Facility ID (optional)
   * @returns {Promise<Array>} - Calendar resources
   */
  async getCalendarResources(facilityId = null) {
    return await this.executeOperation(async () => {
      const { Resource, Facility } = require('../models');

      const whereClause = { resource_status: 'active' };
      if (facilityId) {
        whereClause.facility_id = facilityId;
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

      return resources.map(resource => ({
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
    }, { operation: 'getCalendarResources', facilityId });
  }

  /**
   * Format episode for calendar display
   * @param {Object} episode - Episode object
   * @param {Object} user - User context
   * @returns {Object} - Formatted calendar event
   */
  formatEpisodeForCalendar(episode, user) {
    const facility = episode.event?.resource?.facility;
    const isUserProgram = this.isUserProgram(episode, user);

    return {
      id: episode.episode_id,
      title: episode.episode_title || 'Ice Time',
      start: episode.episode_start_date_time,
      end: episode.episode_end_date_time,
      resourceId: episode.event.resource_id,
      backgroundColor: this.getStatusColor(episode, user.user_type, isUserProgram),
      borderColor: this.getStatusColor(episode, user.user_type, isUserProgram),
      textColor: this.getTextColor(episode, user.user_type, isUserProgram),
      extendedProps: {
        episodeId: episode.episode_id,
        status: episode.episode_status,
        price: episode.episode_price ? `$${parseFloat(episode.episode_price).toFixed(2)}` : 'N/A',
        duration: episode.episode_duration,
        facility: facility?.facility_name,
        facilityTimezone: facility?.facility_time_zone,
        resource: episode.event.resource.resource_name,
        program: episode.program?.program_name || null,
        assignedProgram: episode.assignedProgram?.program_name || null,
        canBook: ['available', 'assigned'].includes(episode.episode_status),
        canEdit: this.canUserEdit(episode, user),
        isUserProgram,
        description: episode.episode_description
      }
    };
  }

  /**
   * Helper methods
   */

  canUserViewFullDetails(episode, user) {
    if (user.user_type === 'admin') return true;
    
    // Schedulers can view details for their programs
    if (user.user_type === 'scheduler') {
      // This would need to check user's programs
      return false; // Simplified for now
    }
    
    return false;
  }

  isUserProgram(episode, user) {
    // This would check if the episode is assigned to user's programs
    return false; // Simplified for now
  }

  canUserEdit(episode, user) {
    if (user.user_type !== 'admin') return false;
    if (new Date(episode.episode_start_date_time) < new Date()) return false;
    if (episode.episode_status === 'booked') return false;
    return true;
  }

  getStatusColor(episode, userType, isUserProgram) {
    const statusColors = {
      'available': '#FFFFFF',
      'assigned': isUserProgram ? '#ed8936' : '#a0aec0',
      'pending': '#f6ad55',
      'booked': isUserProgram ? '#4299e1' : '#a0aec0',
      'maintenance': '#9e9e9e',
      'cancelled': '#9e9e9e'
    };

    if (userType === 'admin' && episode.episode_status === 'assigned' && episode.assigned_to_program_id) {
      return '#2196F3';
    }

    return statusColors[episode.episode_status] || '#FFFFFF';
  }

  getTextColor(episode, userType, isUserProgram) {
    if (episode.episode_status === 'booked' || 
        (episode.episode_status === 'assigned' && isUserProgram)) {
      return '#ffffff';
    }
    return '#000000';
  }

  validateStatusTransition(currentStatus, newStatus) {
    const validStatuses = ['available', 'assigned', 'pending', 'booked', 'maintenance', 'cancelled'];
    
    if (!validStatuses.includes(newStatus)) {
      throw new ValidationError('Invalid episode status');
    }

    // Add status transition rules here if needed
    // For now, allow all transitions for admins
  }

  async handleProgramAssignment(episode, updateFields, user) {
    // If assigning to a program, verify the program exists
    if (updateFields.assigned_to_program_id) {
      const { Program } = require('../models');
      const program = await Program.findByPk(updateFields.assigned_to_program_id);
      if (!program) {
        throw new ValidationError('Invalid program ID');
      }
    }

    // Auto-adjust status based on program assignment
    if (updateFields.assigned_to_program_id && episode.episode_status === 'available') {
      updateFields.episode_status = 'assigned';
    }

    if (!updateFields.assigned_to_program_id && episode.episode_status === 'assigned') {
      updateFields.episode_status = 'available';
    }
  }
}

module.exports = EpisodeService;