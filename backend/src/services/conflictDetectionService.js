// backend/src/services/conflictDetectionService.js
const { Episode, Event, Resource, Facility, FacilityHours, FacilityHoliday } = require('../models');
const { Op } = require('sequelize');

class ConflictDetectionService {
  
  // Main method to check for conflicts when moving/resizing episodes
  async checkEpisodeConflicts({
    episodeId,
    resourceId,
    newStartTime,
    newEndTime,
    facilityId
  }) {
    const conflicts = [];
    const warnings = [];

    try {
      // Check for overlapping episodes
      const overlapConflicts = await this.checkOverlappingEpisodes(
        episodeId, resourceId, newStartTime, newEndTime
      );
      conflicts.push(...overlapConflicts);

      // Check business hours
      const businessHoursResult = await this.checkBusinessHours(
        facilityId, newStartTime, newEndTime
      );
      conflicts.push(...businessHoursResult.conflicts);
      warnings.push(...businessHoursResult.warnings);

      // Check facility holidays
      const holidayResult = await this.checkFacilityHolidays(
        facilityId, newStartTime, newEndTime
      );
      warnings.push(...holidayResult.warnings);

      // Check resource availability
      const resourceResult = await this.checkResourceAvailability(
        resourceId, newStartTime, newEndTime
      );
      conflicts.push(...resourceResult.conflicts);

      // Check minimum/maximum duration
      const durationResult = this.checkDurationLimits(newStartTime, newEndTime);
      conflicts.push(...durationResult.conflicts);
      warnings.push(...durationResult.warnings);

      return {
        conflicts: conflicts.filter(c => c.severity === 'error'),
        warnings: [...warnings, ...conflicts.filter(c => c.severity === 'warning')]
      };

    } catch (error) {
      console.error('Conflict detection error:', error);
      return {
        conflicts: [{
          type: 'system_error',
          severity: 'error',
          title: 'System Error',
          description: 'Unable to validate schedule conflicts'
        }],
        warnings: []
      };
    }
  }

  // Check for overlapping episodes on the same resource
  async checkOverlappingEpisodes(episodeId, resourceId, newStartTime, newEndTime) {
    const conflicts = [];

    try {
      const overlappingEpisodes = await Episode.findAll({
        where: {
          episode_id: { [Op.ne]: episodeId }, // Exclude the episode being moved
          [Op.or]: [
            // Episode starts during the new time slot
            {
              episode_start_date_time: {
                [Op.between]: [newStartTime, newEndTime]
              }
            },
            // Episode ends during the new time slot
            {
              episode_end_date_time: {
                [Op.between]: [newStartTime, newEndTime]
              }
            },
            // Episode completely encompasses the new time slot
            {
              [Op.and]: [
                {
                  episode_start_date_time: {
                    [Op.lte]: newStartTime
                  }
                },
                {
                  episode_end_date_time: {
                    [Op.gte]: newEndTime
                  }
                }
              ]
            }
          ]
        },
        include: [{
          model: Event,
          as: 'event',
          where: { resource_id: resourceId },
          required: true
        }]
      });

      for (const episode of overlappingEpisodes) {
        conflicts.push({
          type: 'overlap',
          severity: 'error',
          title: 'Schedule Overlap',
          description: `Conflicts with existing ice time: ${episode.episode_title}`,
          time: `${this.formatDateTime(episode.episode_start_date_time)} - ${this.formatDateTime(episode.episode_end_date_time)}`,
          episodeId: episode.episode_id
        });
      }

    } catch (error) {
      console.error('Overlap check error:', error);
      conflicts.push({
        type: 'overlap_check_failed',
        severity: 'error',
        title: 'Overlap Check Failed',
        description: 'Unable to verify schedule overlaps'
      });
    }

    return conflicts;
  }

  // Check facility business hours
  async checkBusinessHours(facilityId, newStartTime, newEndTime) {
    const conflicts = [];
    const warnings = [];

    try {
      const facility = await Facility.findByPk(facilityId, {
        include: [{
          model: FacilityHours,
          as: 'operatingHours'
        }]
      });

      if (!facility) {
        conflicts.push({
          type: 'facility_not_found',
          severity: 'error',
          title: 'Facility Not Found',
          description: 'Unable to verify business hours'
        });
        return { conflicts, warnings };
      }

      // Get facility daily hours or use defaults
      const dailyStart = facility.facility_daily_start_time || '06:00:00';
      const dailyEnd = facility.facility_daily_end_time || '23:00:00';

      const startTime = new Date(newStartTime);
      const endTime = new Date(newEndTime);

      // Check if times are within daily hours
      const startTimeStr = startTime.toTimeString().slice(0, 8);
      const endTimeStr = endTime.toTimeString().slice(0, 8);

      if (startTimeStr < dailyStart || endTimeStr > dailyEnd) {
        conflicts.push({
          type: 'business_hours',
          severity: 'error',
          title: 'Outside Business Hours',
          description: `Facility hours are ${dailyStart} - ${dailyEnd}`,
          time: `${this.formatDateTime(newStartTime)} - ${this.formatDateTime(newEndTime)}`
        });
      }

      // Check specific day hours if available
      if (facility.operatingHours && facility.operatingHours.length > 0) {
        const dayOfWeek = startTime.getDay();
        const dayHours = facility.operatingHours.find(h => h.day_of_week === dayOfWeek);

        if (dayHours) {
          if (dayHours.is_closed) {
            conflicts.push({
              type: 'facility_closed',
              severity: 'error',
              title: 'Facility Closed',
              description: `Facility is closed on ${this.getDayName(dayOfWeek)}s`,
              time: this.formatDateTime(newStartTime)
            });
          } else if (startTimeStr < dayHours.open_time || endTimeStr > dayHours.close_time) {
            conflicts.push({
              type: 'day_hours',
              severity: 'error',
              title: 'Outside Day Hours',
              description: `${this.getDayName(dayOfWeek)} hours are ${dayHours.open_time} - ${dayHours.close_time}`,
              time: `${this.formatDateTime(newStartTime)} - ${this.formatDateTime(newEndTime)}`
            });
          }
        }
      }

    } catch (error) {
      console.error('Business hours check error:', error);
      conflicts.push({
        type: 'business_hours_check_failed',
        severity: 'error',
        title: 'Business Hours Check Failed',
        description: 'Unable to verify facility hours'
      });
    }

    return { conflicts, warnings };
  }

  // Check facility holidays
  async checkFacilityHolidays(facilityId, newStartTime, newEndTime) {
    const warnings = [];

    try {
      const startDate = new Date(newStartTime).toISOString().split('T')[0];
      const endDate = new Date(newEndTime).toISOString().split('T')[0];

      const holidays = await FacilityHoliday.findAll({
        where: {
          facility_id: facilityId,
          holiday_date: {
            [Op.between]: [startDate, endDate]
          }
        }
      });

      for (const holiday of holidays) {
        if (holiday.is_closed) {
          warnings.push({
            type: 'holiday_closed',
            severity: 'warning',
            title: 'Holiday Schedule',
            description: `Facility is closed for ${holiday.holiday_name || 'holiday'}`,
            time: this.formatDate(holiday.holiday_date)
          });
        } else if (holiday.special_hours_open || holiday.special_hours_close) {
          warnings.push({
            type: 'holiday_hours',
            severity: 'warning',
            title: 'Holiday Hours',
            description: `Special hours for ${holiday.holiday_name || 'holiday'}: ${holiday.special_hours_open || 'Regular'} - ${holiday.special_hours_close || 'Regular'}`,
            time: this.formatDate(holiday.holiday_date)
          });
        }

        if (holiday.pricing_multiplier && holiday.pricing_multiplier !== 1.0) {
          warnings.push({
            type: 'holiday_pricing',
            severity: 'warning',
            title: 'Holiday Pricing',
            description: `Holiday pricing multiplier: ${holiday.pricing_multiplier}x for ${holiday.holiday_name || 'holiday'}`,
            time: this.formatDate(holiday.holiday_date)
          });
        }
      }

    } catch (error) {
      console.error('Holiday check error:', error);
      warnings.push({
        type: 'holiday_check_failed',
        severity: 'warning',
        title: 'Holiday Check Failed',
        description: 'Unable to verify holiday schedule'
      });
    }

    return { warnings };
  }

  // Check resource availability
  async checkResourceAvailability(resourceId, newStartTime, newEndTime) {
    const conflicts = [];

    try {
      const resource = await Resource.findByPk(resourceId);

      if (!resource) {
        conflicts.push({
          type: 'resource_not_found',
          severity: 'error',
          title: 'Resource Not Found',
          description: 'Selected resource does not exist'
        });
        return { conflicts };
      }

      if (resource.resource_status !== 'active') {
        conflicts.push({
          type: 'resource_unavailable',
          severity: 'error',
          title: 'Resource Unavailable',
          description: `Resource is ${resource.resource_status}`,
          resource: resource.resource_name
        });
      }

    } catch (error) {
      console.error('Resource availability check error:', error);
      conflicts.push({
        type: 'resource_check_failed',
        severity: 'error',
        title: 'Resource Check Failed',
        description: 'Unable to verify resource availability'
      });
    }

    return { conflicts };
  }

  // Check duration limits
  checkDurationLimits(newStartTime, newEndTime) {
    const conflicts = [];
    const warnings = [];

    const duration = Math.round((new Date(newEndTime) - new Date(newStartTime)) / (1000 * 60));

    // Minimum duration check (30 minutes)
    if (duration < 30) {
      conflicts.push({
        type: 'duration_too_short',
        severity: 'error',
        title: 'Duration Too Short',
        description: 'Ice time must be at least 30 minutes long',
        duration: `${duration} minutes`
      });
    }

    // Maximum duration check (8 hours)
    if (duration > 480) {
      conflicts.push({
        type: 'duration_too_long',
        severity: 'error',
        title: 'Duration Too Long',
        description: 'Ice time cannot exceed 8 hours',
        duration: `${Math.round(duration / 60)} hours`
      });
    }

    // Warning for very long durations (4+ hours)
    if (duration > 240 && duration <= 480) {
      warnings.push({
        type: 'duration_long',
        severity: 'warning',
        title: 'Long Duration',
        description: 'This is a very long ice time slot',
        duration: `${Math.round(duration / 60)} hours`
      });
    }

    return { conflicts, warnings };
  }

  // Check for past dates
  checkPastDate(newStartTime) {
    const conflicts = [];
    const now = new Date();

    if (new Date(newStartTime) < now) {
      conflicts.push({
        type: 'past_date',
        severity: 'error',
        title: 'Past Date',
        description: 'Cannot schedule ice time in the past',
        time: this.formatDateTime(newStartTime)
      });
    }

    return conflicts;
  }

  // Utility methods
  formatDateTime(dateTime) {
    return new Date(dateTime).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  }

  getDayName(dayOfWeek) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek] || 'Unknown';
  }

  // Batch conflict checking for multiple episodes
  async checkBatchConflicts(moves) {
    const results = [];

    for (const move of moves) {
      const result = await this.checkEpisodeConflicts({
        episodeId: move.episodeId,
        resourceId: move.resourceId,
        newStartTime: move.newStartTime,
        newEndTime: move.newEndTime,
        facilityId: move.facilityId
      });

      results.push({
        episodeId: move.episodeId,
        ...result
      });
    }

    return results;
  }

  // Check for cross-episode conflicts in batch moves
  checkCrossEpisodeConflicts(moves) {
    const conflicts = [];

    // Sort moves by start time
    const sortedMoves = [...moves].sort((a, b) => 
      new Date(a.newStartTime) - new Date(b.newStartTime)
    );

    // Check each pair for overlaps
    for (let i = 0; i < sortedMoves.length - 1; i++) {
      for (let j = i + 1; j < sortedMoves.length; j++) {
        const move1 = sortedMoves[i];
        const move2 = sortedMoves[j];

        // Only check if they're on the same resource
        if (move1.resourceId === move2.resourceId) {
          const overlap = this.checkTimeOverlap(
            move1.newStartTime, move1.newEndTime,
            move2.newStartTime, move2.newEndTime
          );

          if (overlap) {
            conflicts.push({
              type: 'batch_overlap',
              severity: 'error',
              title: 'Batch Move Conflict',
              description: `Episodes ${move1.episodeId} and ${move2.episodeId} would overlap`,
              episodes: [move1.episodeId, move2.episodeId]
            });
          }
        }
      }
    }

    return conflicts;
  }

  // Check if two time ranges overlap
  checkTimeOverlap(start1, end1, start2, end2) {
    const s1 = new Date(start1);
    const e1 = new Date(end1);
    const s2 = new Date(start2);
    const e2 = new Date(end2);

    return s1 < e2 && s2 < e1;
  }
}

module.exports = new ConflictDetectionService();