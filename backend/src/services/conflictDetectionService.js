// backend/src/services/conflictDetectionService.js (Simplified - Local Time)
const { Episode, Event, Resource, Facility } = require('../models');
const { Op } = require('sequelize');

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
      console.log('Checking conflicts for episode:', episodeId, 'resource:', resourceId);
      console.log('New time range:', newStartTime, 'to', newEndTime);

      // Ensure we have Date objects
      const startTime = new Date(newStartTime);
      const endTime = new Date(newEndTime);

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        conflicts.push({
          type: 'invalid_date',
          severity: 'error',
          title: 'Invalid Date',
          description: 'Invalid date format provided'
        });
        return { conflicts, warnings };
      }

      // Check for overlapping episodes
      const overlapConflicts = await this.checkOverlappingEpisodes(
        episodeId, resourceId, startTime, endTime, skipSelf
      );
      conflicts.push(...overlapConflicts);

      // Business hours check
      const businessHoursResult = await this.checkBusinessHours(
        facilityId, startTime, endTime
      );
      conflicts.push(...businessHoursResult.conflicts);
      warnings.push(...businessHoursResult.warnings);

      // Check for past dates
      if (startTime < new Date()) {
        conflicts.push({
          type: 'past_date',
          severity: 'error',
          title: 'Past Date',
          description: 'Cannot schedule ice time in the past'
        });
      }

      // Duration check
      const duration = Math.round((endTime - startTime) / (1000 * 60));
      if (duration < 30) {
        conflicts.push({
          type: 'duration_too_short',
          severity: 'error',
          title: 'Duration Too Short',
          description: 'Ice time must be at least 30 minutes long'
        });
      }

      if (duration > 480) { // 8 hours
        conflicts.push({
          type: 'duration_too_long',
          severity: 'error',
          title: 'Duration Too Long',
          description: 'Ice time cannot exceed 8 hours'
        });
      }

      console.log(`Found ${conflicts.length} conflicts and ${warnings.length} warnings`);

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
            as: 'resource'
          }]
        }]
      });

      console.log(`Found ${overlappingEpisodes.length} overlapping episodes`);

      for (const episode of overlappingEpisodes) {
        conflicts.push({
          type: 'overlap',
          severity: 'error',
          title: 'Schedule Overlap',
          description: `Conflicts with existing ice time: "${episode.episode_title}"`,
          time: `${episode.episode_start_date_time} - ${episode.episode_end_date_time}`,
          episodeId: episode.episode_id,
          resource: episode.event.resource.resource_name
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

  // Check business hours (simplified)
  async checkBusinessHours(facilityId, startTime, endTime) {
    const conflicts = [];
    const warnings = [];

    try {
      const facility = await Facility.findByPk(facilityId);

      if (!facility) {
        conflicts.push({
          type: 'facility_not_found',
          severity: 'error',
          title: 'Facility Not Found',
          description: 'Unable to verify business hours'
        });
        return { conflicts, warnings };
      }

      // Extract hours for business hours check
      const startHour = startTime.getHours();
      const startMinutes = startTime.getMinutes();
      const endHour = endTime.getHours();
      const endMinutes = endTime.getMinutes();

      // Parse facility hours (default 6 AM to 11 PM)
      const dailyStart = facility.facility_daily_start_time || '06:00:00';
      const dailyEnd = facility.facility_daily_end_time || '23:00:00';
      
      const [facilityStartHour, facilityStartMin] = dailyStart.split(':').map(Number);
      const [facilityEndHour, facilityEndMin] = dailyEnd.split(':').map(Number);

      // Check if outside business hours
      const startTimeMinutes = startHour * 60 + startMinutes;
      const endTimeMinutes = endHour * 60 + endMinutes;
      const facilityStartMinutes = facilityStartHour * 60 + facilityStartMin;
      const facilityEndMinutes = facilityEndHour * 60 + facilityEndMin;

      if (startTimeMinutes < facilityStartMinutes || endTimeMinutes > facilityEndMinutes) {
        conflicts.push({
          type: 'business_hours',
          severity: 'error',
          title: 'Outside Business Hours',
          description: `Facility hours are ${dailyStart.slice(0, 5)} - ${dailyEnd.slice(0, 5)}`
        });
      }

      // Warning for unusual hours
      if (startHour < 6 || endHour > 22) {
        warnings.push({
          type: 'unusual_hours',
          severity: 'warning',
          title: 'Unusual Hours',
          description: 'This time is outside typical arena operating hours'
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

  // Batch conflict checking
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

    } catch (error) {
      console.error('Batch conflict check error:', error);
    }

    return results;
  }

  // Utility method to check if two time ranges overlap
  checkTimeOverlap(start1, end1, start2, end2) {
    const s1 = new Date(start1);
    const e1 = new Date(end1);
    const s2 = new Date(start2);
    const e2 = new Date(end2);

    return s1 < e2 && s2 < e1;
  }
}

module.exports = new ConflictDetectionService();