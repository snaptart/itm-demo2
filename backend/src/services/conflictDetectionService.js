// backend/src/services/conflictDetectionService.js (Activated and Enhanced)
const { Episode, Event, Resource, Facility, FacilityHours, FacilityHoliday } = require('../models');
const { Op } = require('sequelize');
const TimezoneUtils = require('../utils/timezoneUtils');

class ConflictDetectionService {
  
  // Main method to check for conflicts when moving/resizing episodes
  async checkEpisodeConflicts({
    episodeId,
    resourceId,
    newStartTime,
    newEndTime,
    facilityId,
    skipSelf = true
  }) {
    const conflicts = [];
    const warnings = [];

    try {
      // Get facility for timezone context
      const facility = await Facility.findByPk(facilityId);
      const facilityTimezone = facility?.facility_time_zone || TimezoneUtils.DEFAULT_TIMEZONE;

      // Convert times to UTC for database queries
      const utcStartTime = TimezoneUtils.parseAndConvertToUTC(newStartTime, facilityTimezone);
      const utcEndTime = TimezoneUtils.parseAndConvertToUTC(newEndTime, facilityTimezone);

      // Check for overlapping episodes
      const overlapConflicts = await this.checkOverlappingEpisodes(
        episodeId, resourceId, utcStartTime, utcEndTime, skipSelf
      );
      conflicts.push(...overlapConflicts);

      // Check business hours
      const businessHoursResult = await this.checkBusinessHours(
        facilityId, utcStartTime, utcEndTime, facilityTimezone
      );
      conflicts.push(...businessHoursResult.conflicts);
      warnings.push(...businessHoursResult.warnings);

      // Check facility holidays
      const holidayResult = await this.checkFacilityHolidays(
        facilityId, utcStartTime, utcEndTime, facilityTimezone
      );
      warnings.push(...holidayResult.warnings);

      // Check resource availability
      const resourceResult = await this.checkResourceAvailability(
        resourceId, utcStartTime, utcEndTime
      );
      conflicts.push(...resourceResult.conflicts);

      // Check minimum/maximum duration
      const durationResult = this.checkDurationLimits(utcStartTime, utcEndTime, facility);
      conflicts.push(...durationResult.conflicts);
      warnings.push(...durationResult.warnings);

      // Check for past dates
      const pastDateConflicts = this.checkPastDate(utcStartTime, facilityTimezone);
      conflicts.push(...pastDateConflicts);

      // Check for DST boundary crossings
      if (episodeId) {
        const originalEpisode = await Episode.findByPk(episodeId);
        if (originalEpisode) {
          const dstWarnings = this.checkDSTBoundary(
            originalEpisode.episode_start_date_time,
            utcStartTime,
            facilityTimezone
          );
          warnings.push(...dstWarnings);
        }
      }

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
          description: 'Unable to validate schedule conflicts',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }],
        warnings: []
      };
    }
  }

  // Check for overlapping episodes on the same resource
  async checkOverlappingEpisodes(episodeId, resourceId, newStartTime, newEndTime, skipSelf = true) {
    const conflicts = [];

    try {
      const whereClause = {
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
          },
          // New time slot completely encompasses existing episode
          {
            [Op.and]: [
              {
                episode_start_date_time: {
                  [Op.gte]: newStartTime
                }
              },
              {
                episode_end_date_time: {
                  [Op.lte]: newEndTime
                }
              }
            ]
          }
        ]
      };

      // Exclude the episode being moved if specified
      if (skipSelf && episodeId) {
        whereClause.episode_id = { [Op.ne]: episodeId };
      }

      const overlappingEpisodes = await Episode.findAll({
        where: whereClause,
        include: [{
          model: Event,
          as: 'event',
          where: { resource_id: resourceId },
          required: true,
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

      for (const episode of overlappingEpisodes) {
        const facilityTimezone = episode.event.resource.facility.facility_time_zone || 
                               TimezoneUtils.DEFAULT_TIMEZONE;
        
        conflicts.push({
          type: 'overlap',
          severity: 'error',
          title: 'Schedule Overlap',
          description: `Conflicts with existing ice time: "${episode.episode_title}"`,
          time: TimezoneUtils.formatTimeRange(
            episode.episode_start_date_time,
            episode.episode_end_date_time,
            facilityTimezone
          ),
          episodeId: episode.episode_id,
          resource: episode.event.resource.resource_name,
          details: [`Status: ${episode.episode_status}`, `Duration: ${episode.episode_duration} minutes`]
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
  async checkBusinessHours(facilityId, newStartTime, newEndTime, facilityTimezone) {
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

      // Convert to facility timezone for business hours check
      const startTime = TimezoneUtils.convertToFacilityTime(newStartTime, facilityTimezone);
      const endTime = TimezoneUtils.convertToFacilityTime(newEndTime, facilityTimezone);

      // Get facility daily hours or use defaults
      const dailyStart = facility.facility_daily_start_time || '06:00:00';
      const dailyEnd = facility.facility_daily_end_time || '23:00:00';

      const startTimeStr = startTime.format('HH:mm:ss');
      const endTimeStr = endTime.format('HH:mm:ss');

      // Check if times are within daily hours
      if (startTimeStr < dailyStart || endTimeStr > dailyEnd) {
        conflicts.push({
          type: 'business_hours',
          severity: 'error',
          title: 'Outside Business Hours',
          description: `Facility hours are ${dailyStart} - ${dailyEnd}`,
          time: TimezoneUtils.formatTimeRange(newStartTime, newEndTime, facilityTimezone),
          details: [
            `Facility timezone: ${facilityTimezone}`,
            `Requested: ${startTimeStr} - ${endTimeStr}`
          ]
        });
      }

      // Check specific day hours if available
      if (facility.operatingHours && facility.operatingHours.length > 0) {
        const dayOfWeek = startTime.day();
        const dayHours = facility.operatingHours.find(h => h.day_of_week === dayOfWeek);

        if (dayHours) {
          if (dayHours.is_closed) {
            conflicts.push({
              type: 'facility_closed',
              severity: 'error',
              title: 'Facility Closed',
              description: `Facility is closed on ${this.getDayName(dayOfWeek)}s`,
              time: TimezoneUtils.formatForDisplay(newStartTime, facilityTimezone, 'dddd, MMM D, YYYY')
            });
          } else if (startTimeStr < dayHours.open_time || endTimeStr > dayHours.close_time) {
            conflicts.push({
              type: 'day_hours',
              severity: 'error',
              title: 'Outside Day Hours',
              description: `${this.getDayName(dayOfWeek)} hours are ${dayHours.open_time} - ${dayHours.close_time}`,
              time: TimezoneUtils.formatTimeRange(newStartTime, newEndTime, facilityTimezone)
            });
          }
        }
      }

      // Add ice time validation warning
      const iceTimeValidation = TimezoneUtils.validateIceTimeHours(newStartTime, facilityTimezone);
      if (!iceTimeValidation.isValid) {
        warnings.push({
          type: 'unusual_hours',
          severity: 'warning',
          title: 'Unusual Hours',
          description: iceTimeValidation.warning,
          time: TimezoneUtils.formatTimeRange(newStartTime, newEndTime, facilityTimezone)
        });
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
  async checkFacilityHolidays(facilityId, newStartTime, newEndTime, facilityTimezone) {
    const warnings = [];

    try {
      const startDate = TimezoneUtils.convertToFacilityTime(newStartTime, facilityTimezone).format('YYYY-MM-DD');
      const endDate = TimezoneUtils.convertToFacilityTime(newEndTime, facilityTimezone).format('YYYY-MM-DD');

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
            time: this.formatDate(holiday.holiday_date),
            details: ['Facility will be closed during this time']
          });
        } else if (holiday.special_hours_open || holiday.special_hours_close) {
          warnings.push({
            type: 'holiday_hours',
            severity: 'warning',
            title: 'Holiday Hours',
            description: `Special hours for ${holiday.holiday_name || 'holiday'}`,
            time: this.formatDate(holiday.holiday_date),
            details: [`Hours: ${holiday.special_hours_open || 'Regular'} - ${holiday.special_hours_close || 'Regular'}`]
          });
        }

        if (holiday.pricing_multiplier && holiday.pricing_multiplier !== 1.0) {
          warnings.push({
            type: 'holiday_pricing',
            severity: 'warning',
            title: 'Holiday Pricing',
            description: `Holiday pricing applies (${holiday.pricing_multiplier}x rate)`,
            time: this.formatDate(holiday.holiday_date),
            details: [`Rate multiplier: ${holiday.pricing_multiplier}x for ${holiday.holiday_name || 'holiday'}`]
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
      const resource = await Resource.findByPk(resourceId, {
        include: [{
          model: Facility,
          as: 'facility'
        }]
      });

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
          description: `Rink "${resource.resource_name}" is currently ${resource.resource_status}`,
          resource: resource.resource_name,
          details: [`Status: ${resource.resource_status}`, `Facility: ${resource.facility?.facility_name}`]
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
  checkDurationLimits(newStartTime, newEndTime, facility = null) {
    const conflicts = [];
    const warnings = [];

    const duration = TimezoneUtils.calculateDurationWithDST(
      newStartTime, 
      newEndTime, 
      facility?.facility_time_zone
    );

    // Get facility-specific limits or use defaults
    const minDuration = facility?.min_booking_duration || 30;
    const maxDuration = facility?.max_booking_duration || 480; // 8 hours

    // Minimum duration check
    if (duration < minDuration) {
      conflicts.push({
        type: 'duration_too_short',
        severity: 'error',
        title: 'Duration Too Short',
        description: `Ice time must be at least ${minDuration} minutes long`,
        duration: `${duration} minutes`,
        details: [`Minimum allowed: ${minDuration} minutes`, `Current duration: ${duration} minutes`]
      });
    }

    // Maximum duration check
    if (duration > maxDuration) {
      conflicts.push({
        type: 'duration_too_long',
        severity: 'error',
        title: 'Duration Too Long',
        description: `Ice time cannot exceed ${Math.round(maxDuration / 60)} hours`,
        duration: `${Math.round(duration / 60)} hours`,
        details: [`Maximum allowed: ${maxDuration} minutes`, `Current duration: ${duration} minutes`]
      });
    }

    // Warning for very long durations (4+ hours)
    if (duration > 240 && duration <= maxDuration) {
      warnings.push({
        type: 'duration_long',
        severity: 'warning',
        title: 'Long Duration',
        description: 'This is a very long ice time slot',
        duration: `${Math.round(duration / 60)} hours`,
        details: [`Duration: ${duration} minutes (${Math.round(duration / 60)} hours)`]
      });
    }

    return { conflicts, warnings };
  }

  // Check for past dates
  checkPastDate(newStartTime, facilityTimezone) {
    const conflicts = [];
    
    try {
      const now = TimezoneUtils.getCurrentTime(facilityTimezone);
      const startTime = TimezoneUtils.convertToFacilityTime(newStartTime, facilityTimezone);

      if (startTime.isBefore(now)) {
        conflicts.push({
          type: 'past_date',
          severity: 'error',
          title: 'Past Date',
          description: 'Cannot schedule ice time in the past',
          time: TimezoneUtils.formatForDisplay(newStartTime, facilityTimezone, 'MMM D, YYYY h:mm A z'),
          details: [`Current time: ${now.format('MMM D, YYYY h:mm A z')}`]
        });
      }
    } catch (error) {
      console.error('Past date check error:', error);
    }

    return conflicts;
  }

  // Check for DST boundary crossings
  checkDSTBoundary(originalStartTime, newStartTime, facilityTimezone) {
    const warnings = [];

    try {
      if (TimezoneUtils.crossesDSTBoundary(originalStartTime, newStartTime, facilityTimezone)) {
        const originalTime = TimezoneUtils.convertToFacilityTime(originalStartTime, facilityTimezone);
        const newTime = TimezoneUtils.convertToFacilityTime(newStartTime, facilityTimezone);
        
        warnings.push({
          type: 'dst_boundary',
          severity: 'warning',
          title: 'Daylight Saving Time Change',
          description: 'This move crosses a daylight saving time boundary',
          details: [
            `Original time: ${originalTime.format('MMM D, YYYY h:mm A z')} (DST: ${originalTime.isDST()})`,
            `New time: ${newTime.format('MMM D, YYYY h:mm A z')} (DST: ${newTime.isDST()})`
          ]
        });
      }
    } catch (error) {
      console.error('DST boundary check error:', error);
    }

    return warnings;
  }

  // Utility methods
  formatDateTime(dateTime, facilityTimezone = TimezoneUtils.DEFAULT_TIMEZONE) {
    return TimezoneUtils.formatForDisplay(dateTime, facilityTimezone, 'ddd, MMM D, h:mm A z');
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
  async checkBatchConflicts(moves, facilityId) {
    const results = [];

    try {
      // Check each move individually
      for (const move of moves) {
        const result = await this.checkEpisodeConflicts({
          episodeId: move.episodeId,
          resourceId: move.resourceId,
          newStartTime: move.newStartTime,
          newEndTime: move.newEndTime,
          facilityId
        });

        results.push({
          episodeId: move.episodeId,
          ...result
        });
      }

      // Check for cross-episode conflicts in the batch
      const crossConflicts = this.checkCrossEpisodeConflicts(moves);
      
      // Add cross conflicts to relevant episodes
      for (const conflict of crossConflicts) {
        for (const episodeId of conflict.episodes) {
          const resultIndex = results.findIndex(r => r.episodeId === episodeId);
          if (resultIndex >= 0) {
            results[resultIndex].conflicts.push(conflict);
          }
        }
      }

    } catch (error) {
      console.error('Batch conflict check error:', error);
    }

    return results;
  }

  // Check for cross-episode conflicts in batch moves
  checkCrossEpisodeConflicts(moves) {
    const conflicts = [];

    // Sort moves by start time and resource
    const movesByResource = {};
    
    for (const move of moves) {
      if (!movesByResource[move.resourceId]) {
        movesByResource[move.resourceId] = [];
      }
      movesByResource[move.resourceId].push(move);
    }

    // Check each resource for overlaps
    for (const [resourceId, resourceMoves] of Object.entries(movesByResource)) {
      const sortedMoves = resourceMoves.sort((a, b) => 
        new Date(a.newStartTime) - new Date(b.newStartTime)
      );

      // Check each pair for overlaps
      for (let i = 0; i < sortedMoves.length - 1; i++) {
        for (let j = i + 1; j < sortedMoves.length; j++) {
          const move1 = sortedMoves[i];
          const move2 = sortedMoves[j];

          if (this.checkTimeOverlap(
            move1.newStartTime, move1.newEndTime,
            move2.newStartTime, move2.newEndTime
          )) {
            conflicts.push({
              type: 'batch_overlap',
              severity: 'error',
              title: 'Batch Move Conflict',
              description: `Multiple episodes would overlap on the same resource`,
              episodes: [move1.episodeId, move2.episodeId],
              resource: resourceId,
              details: [
                `Episode ${move1.episodeId}: ${move1.newStartTime} - ${move1.newEndTime}`,
                `Episode ${move2.episodeId}: ${move2.newStartTime} - ${move2.newEndTime}`
              ]
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