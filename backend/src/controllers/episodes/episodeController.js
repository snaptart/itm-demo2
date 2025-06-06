// backend/src/controllers/episodes/episodeController.js (Refactored)
const EpisodeService = require('../../services/EpisodeService');
const ResponseFormatter = require('../../utils/responseFormatter');
const { asyncErrorHandler } = require('../../middleware/errorHandler');
const logger = require('../../utils/logger');

class EpisodeController {
  constructor() {
    this.episodeService = new EpisodeService();
  }

  /**
   * Get episodes for calendar view
   */
  getEpisodes = asyncErrorHandler(async (req, res) => {
    const startTime = Date.now();
    
    const filters = {
      start: req.query.start,
      end: req.query.end,
      facility_id: req.query.facility_id,
      resource_id: req.query.resource_id,
      status: req.query.status,
      program_id: req.query.program_id
    };

    const events = await this.episodeService.getEpisodesForCalendar(filters, req.user);

    // Get facility timezone if facility_id provided
    let timezone = null;
    if (filters.facility_id) {
      const { Facility } = require('../../models');
      const facility = await Facility.findByPk(filters.facility_id);
      timezone = facility?.facility_time_zone;
    }

    const duration = Date.now() - startTime;
    logger.performance('getEpisodes', duration, { 
      eventCount: events.length, 
      filters,
      user: req.user.username 
    });

    return ResponseFormatter.success(res, {
      events,
      timezone
    }, 'Episodes retrieved successfully', 200, {
      total: events.length,
      filters
    });
  });

  /**
   * Get single episode by ID
   */
  getEpisodeById = asyncErrorHandler(async (req, res) => {
    const { id } = req.params;
    const result = await this.episodeService.getEpisodeById(id, req.user);

    return ResponseFormatter.success(res, result, 'Episode retrieved successfully');
  });

  /**
   * Get calendar resources
   */
  getCalendarResources = asyncErrorHandler(async (req, res) => {
    const { facility_id } = req.query;
    const resources = await this.episodeService.getCalendarResources(facility_id);

    return ResponseFormatter.success(res, {
      resources
    }, 'Calendar resources retrieved successfully', 200, {
      total: resources.length
    });
  });

  /**
   * Validate episode move
   */
  validateEpisodeMove = asyncErrorHandler(async (req, res) => {
    const validation = await this.episodeService.validateEpisodeMove(req.body, req.user);

    return ResponseFormatter.success(res, validation, 'Validation completed');
  });

  /**
   * Move episode to new time slot
   */
  moveEpisode = asyncErrorHandler(async (req, res) => {
    const { id } = req.params;
    const result = await this.episodeService.moveEpisode(id, req.body, req.user);

    logger.business('Episode moved via API', {
      episodeId: id,
      user: req.user.username,
      newStart: req.body.new_start_time,
      newEnd: req.body.new_end_time
    });

    return ResponseFormatter.success(res, result, 'Episode moved successfully');
  });

  /**
   * Resize episode (change end time)
   */
  resizeEpisode = asyncErrorHandler(async (req, res) => {
    const { id } = req.params;
    const result = await this.episodeService.resizeEpisode(id, req.body, req.user);

    logger.business('Episode resized via API', {
      episodeId: id,
      user: req.user.username,
      newEnd: req.body.new_end_time
    });

    return ResponseFormatter.success(res, result, 'Episode resized successfully');
  });

  /**
   * Update episode details
   */
  updateEpisode = asyncErrorHandler(async (req, res) => {
    const { id } = req.params;
    const result = await this.episodeService.updateEpisode(id, req.body, req.user);

    return ResponseFormatter.updated(res, result, 'Episode updated successfully', {
      episodeId: id,
      updatedFields: Object.keys(req.body)
    });
  });

  /**
   * Delete episode
   */
  deleteEpisode = asyncErrorHandler(async (req, res) => {
    const { id } = req.params;
    const result = await this.episodeService.deleteEpisode(id, req.user);

    return ResponseFormatter.deleted(res, 'Episode deleted successfully', {
      episodeId: id
    });
  });

  // Placeholder methods for not yet implemented features
  validateBatchMoves = asyncErrorHandler(async (req, res) => {
    return ResponseFormatter.success(res, null, 'Batch validation not yet implemented', 501);
  });

  createEpisode = asyncErrorHandler(async (req, res) => {
    return ResponseFormatter.success(res, null, 'Create episode not yet implemented', 501);
  });
}

module.exports = new EpisodeController();