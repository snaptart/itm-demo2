// backend/src/repositories/EpisodeRepository.js
const BaseRepository = require('./BaseRepository');
const { Episode, Event, Resource, Facility, Program, Booking } = require('../models');
const { Op } = require('sequelize');

class EpisodeRepository extends BaseRepository {
  constructor() {
    super(Episode);
  }

  /**
   * Find episodes with calendar filtering
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Episodes with associations
   */
  async findForCalendar(filters = {}, options = {}) {
    const {
      start,
      end,
      facility_id,
      resource_id,
      status,
      program_id,
      user_id,
      user_type
    } = filters;

    const whereClause = {};
    const eventWhere = {};
    const resourceWhere = {};
    const facilityWhere = {};

    // Date range filter
    if (start && end) {
      whereClause.episode_start_date_time = {
        [Op.between]: [new Date(start), new Date(end)]
      };
    }

    // Status filter
    if (status) {
      whereClause.episode_status = Array.isArray(status) ? { [Op.in]: status } : status;
    }

    // Program filter
    if (program_id) {
      whereClause[Op.or] = [
        { program_id },
        { assigned_to_program_id: program_id }
      ];
    }

    // Resource and facility filters
    if (resource_id) {
      eventWhere.resource_id = resource_id;
    }
    if (facility_id) {
      facilityWhere.facility_id = facility_id;
    }

    // User-specific filtering for schedulers
    if (user_type === 'scheduler' && user_id) {
      const userPrograms = await this.getUserPrograms(user_id);
      const programIds = userPrograms.map(p => p.program_id);

      if (programIds.length > 0) {
        whereClause[Op.or] = [
          { episode_status: 'available', assigned_to_program_id: null },
          { episode_status: 'assigned', assigned_to_program_id: { [Op.in]: programIds } },
          { program_id: { [Op.in]: programIds } },
          { assigned_to_program_id: { [Op.in]: programIds } }
        ];
      } else {
        whereClause.episode_status = 'available';
        whereClause.assigned_to_program_id = null;
      }
    }

    return await this.findAll(whereClause, {
      include: [
        {
          model: Event,
          as: 'event',
          required: true,
          where: Object.keys(eventWhere).length > 0 ? eventWhere : undefined,
          include: [
            {
              model: Resource,
              as: 'resource',
              required: true,
              where: Object.keys(resourceWhere).length > 0 ? resourceWhere : undefined,
              include: [
                {
                  model: Facility,
                  as: 'facility',
                  required: true,
                  where: Object.keys(facilityWhere).length > 0 ? facilityWhere : undefined
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
      ],
      order: [['episode_start_date_time', 'ASC']],
      limit: options.limit || 1000
    });
  }

  /**
   * Find episodes with conflicts
   * @param {number} episodeId - Episode ID to exclude
   * @param {number} resourceId - Resource ID
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time
   * @returns {Promise<Array>} - Conflicting episodes
   */
  async findConflicting(episodeId, resourceId, startTime, endTime) {
    const whereClause = {
      [Op.and]: [
        episodeId ? { episode_id: { [Op.ne]: episodeId } } : {},
        {
          [Op.or]: [
            // Episode starts during the new time slot
            {
              episode_start_date_time: {
                [Op.between]: [startTime, endTime]
              }
            },
            // Episode ends during the new time slot
            {
              episode_end_date_time: {
                [Op.between]: [startTime, endTime]
              }
            },
            // Episode completely encompasses the new time slot
            {
              [Op.and]: [
                { episode_start_date_time: { [Op.lte]: startTime } },
                { episode_end_date_time: { [Op.gte]: endTime } }
              ]
            },
            // New time slot completely encompasses existing episode
            {
              [Op.and]: [
                { episode_start_date_time: { [Op.gte]: startTime } },
                { episode_end_date_time: { [Op.lte]: endTime } }
              ]
            }
          ]
        }
      ]
    };

    return await this.findAll(whereClause, {
      include: [
        {
          model: Event,
          as: 'event',
          required: true,
          where: { resource_id: resourceId },
          include: [
            {
              model: Resource,
              as: 'resource'
            }
          ]
        }
      ]
    });
  }

  /**
   * Find episode with full details
   * @param {number} id - Episode ID
   * @returns {Promise<Object|null>} - Episode with all associations
   */
  async findWithDetails(id) {
    return await this.findById(id, {
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
              model: require('../models').User,
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
  }

  /**
   * Update episode times
   * @param {number} id - Episode ID
   * @param {Date} newStartTime - New start time
   * @param {Date} newEndTime - New end time
   * @param {string} updatedBy - User making the update
   * @param {Object} transaction - Database transaction
   * @returns {Promise<Object>} - Updated episode
   */
  async updateTimes(id, newStartTime, newEndTime, updatedBy, transaction) {
    const duration = Math.round((new Date(newEndTime) - new Date(newStartTime)) / (1000 * 60));

    return await this.updateById(id, {
      episode_start_date_time: newStartTime,
      episode_end_date_time: newEndTime,
      episode_duration: duration,
      updated_by: updatedBy
    }, { transaction });
  }

  /**
   * Bulk update episode status
   * @param {Array<number>} episodeIds - Episode IDs
   * @param {string} status - New status
   * @param {string} updatedBy - User making the update
   * @param {Object} transaction - Database transaction
   * @returns {Promise<number>} - Number of updated episodes
   */
  async bulkUpdateStatus(episodeIds, status, updatedBy, transaction) {
    const [affectedCount] = await Episode.update(
      {
        episode_status: status,
        updated_by: updatedBy
      },
      {
        where: { episode_id: { [Op.in]: episodeIds } },
        transaction,
        logging: this.getQueryLogger('bulkUpdateStatus', { episodeIds, status })
      }
    );

    return affectedCount;
  }

  /**
   * Find episodes by status
   * @param {string|Array} status - Episode status(es)
   * @param {Object} filters - Additional filters
   * @returns {Promise<Array>} - Episodes matching status
   */
  async findByStatus(status, filters = {}) {
    const whereClause = {
      episode_status: Array.isArray(status) ? { [Op.in]: status } : status,
      ...filters
    };

    return await this.findAll(whereClause, {
      include: [
        {
          model: Event,
          as: 'event',
          include: [
            {
              model: Resource,
              as: 'resource',
              include: [{ model: Facility, as: 'facility' }]
            }
          ]
        },
        { model: Program, as: 'program' },
        { model: Program, as: 'assignedProgram' }
      ],
      order: [['episode_start_date_time', 'ASC']]
    });
  }

  /**
   * Find episodes assigned to programs
   * @param {Array<number>} programIds - Program IDs
   * @param {Object} filters - Additional filters
   * @returns {Promise<Array>} - Episodes assigned to programs
   */
  async findAssignedToPrograms(programIds, filters = {}) {
    const whereClause = {
      [Op.or]: [
        { program_id: { [Op.in]: programIds } },
        { assigned_to_program_id: { [Op.in]: programIds } }
      ],
      ...filters
    };

    return await this.findAll(whereClause, {
      include: [
        {
          model: Event,
          as: 'event',
          include: [
            {
              model: Resource,
              as: 'resource',
              include: [{ model: Facility, as: 'facility' }]
            }
          ]
        },
        { model: Program, as: 'program' },
        { model: Program, as: 'assignedProgram' }
      ],
      order: [['episode_start_date_time', 'ASC']]
    });
  }

  /**
   * Count episodes by facility and date range
   * @param {number} facilityId - Facility ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} - Episode counts by status
   */
  async countByFacilityAndDateRange(facilityId, startDate, endDate) {
    const results = await this.model.findAll({
      attributes: [
        'episode_status',
        [require('sequelize').fn('COUNT', require('sequelize').col('episode_id')), 'count']
      ],
      include: [
        {
          model: Event,
          as: 'event',
          required: true,
          include: [
            {
              model: Resource,
              as: 'resource',
              required: true,
              where: { facility_id: facilityId }
            }
          ]
        }
      ],
      where: {
        episode_start_date_time: {
          [Op.between]: [startDate, endDate]
        }
      },
      group: ['episode_status'],
      raw: true
    });

    return results.reduce((acc, item) => {
      acc[item.episode_status] = parseInt(item.count);
      return acc;
    }, {});
  }

  /**
   * Find available episodes in time range
   * @param {number} facilityId - Facility ID
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time
   * @param {number} duration - Desired duration in minutes
   * @returns {Promise<Array>} - Available episodes
   */
  async findAvailableInTimeRange(facilityId, startTime, endTime, duration = null) {
    const whereClause = {
      episode_status: 'available',
      episode_start_date_time: {
        [Op.between]: [startTime, endTime]
      }
    };

    if (duration) {
      whereClause.episode_duration = { [Op.gte]: duration };
    }

    return await this.findAll(whereClause, {
      include: [
        {
          model: Event,
          as: 'event',
          required: true,
          include: [
            {
              model: Resource,
              as: 'resource',
              required: true,
              where: { facility_id: facilityId }
            }
          ]
        }
      ],
      order: [['episode_start_date_time', 'ASC']]
    });
  }

  /**
   * Get user programs (helper method)
   * @param {number} userId - User ID
   * @returns {Promise<Array>} - User's programs
   */
  async getUserPrograms(userId) {
    const { Program } = require('../models');
    return await Program.findAll({
      where: {
        [Op.or]: [
          { scheduler_user_id: userId },
          { program_admin_user_id: userId }
        ]
      },
      attributes: ['program_id', 'program_name']
    });
  }

  /**
   * Check if episode can be edited
   * @param {number} id - Episode ID
   * @param {Object} user - User object
   * @returns {Promise<boolean>} - Whether episode can be edited
   */
  async canBeEdited(id, user) {
    const episode = await this.findWithDetails(id);
    
    if (!episode) return false;
    if (user.user_type !== 'admin') return false;
    if (new Date(episode.episode_start_date_time) < new Date()) return false;
    if (episode.episode_status === 'booked') return false;
    
    // Check for active bookings
    if (episode.bookings && episode.bookings.some(b => ['pending', 'approved'].includes(b.booking_status))) {
      return false;
    }
    
    return true;
  }

  /**
   * Get episode statistics for facility
   * @param {number} facilityId - Facility ID
   * @param {Object} dateRange - Date range for statistics
   * @returns {Promise<Object>} - Episode statistics
   */
  async getStatistics(facilityId, dateRange = {}) {
    const { startDate, endDate } = dateRange;
    const whereClause = {};

    if (startDate && endDate) {
      whereClause.episode_start_date_time = {
        [Op.between]: [startDate, endDate]
      };
    }

    const [statusCounts, totalRevenue, averageDuration] = await Promise.all([
      this.countByFacilityAndDateRange(facilityId, startDate, endDate),
      this.getTotalRevenue(facilityId, whereClause),
      this.getAverageDuration(facilityId, whereClause)
    ]);

    return {
      statusCounts,
      totalRevenue,
      averageDuration,
      total: Object.values(statusCounts).reduce((sum, count) => sum + count, 0)
    };
  }

  /**
   * Get total revenue for facility
   * @param {number} facilityId - Facility ID
   * @param {Object} whereClause - Additional where conditions
   * @returns {Promise<number>} - Total revenue
   */
  async getTotalRevenue(facilityId, whereClause = {}) {
    const result = await this.model.findOne({
      attributes: [
        [require('sequelize').fn('SUM', require('sequelize').col('episode_price')), 'total']
      ],
      include: [
        {
          model: Event,
          as: 'event',
          required: true,
          include: [
            {
              model: Resource,
              as: 'resource',
              required: true,
              where: { facility_id: facilityId }
            }
          ]
        }
      ],
      where: {
        episode_status: 'booked',
        episode_price: { [Op.ne]: null },
        ...whereClause
      },
      raw: true
    });

    return parseFloat(result?.total || 0);
  }

  /**
   * Get average episode duration for facility
   * @param {number} facilityId - Facility ID
   * @param {Object} whereClause - Additional where conditions
   * @returns {Promise<number>} - Average duration in minutes
   */
  async getAverageDuration(facilityId, whereClause = {}) {
    const result = await this.model.findOne({
      attributes: [
        [require('sequelize').fn('AVG', require('sequelize').col('episode_duration')), 'average']
      ],
      include: [
        {
          model: Event,
          as: 'event',
          required: true,
          include: [
            {
              model: Resource,
              as: 'resource',
              required: true,
              where: { facility_id: facilityId }
            }
          ]
        }
      ],
      where: {
        episode_duration: { [Op.ne]: null },
        ...whereClause
      },
      raw: true
    });

    return Math.round(parseFloat(result?.average || 60));
  }
}

module.exports = EpisodeRepository;