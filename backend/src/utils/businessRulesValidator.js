// backend/src/utils/businessRulesValidator.js
const { Booking, Program } = require('../models');
const { Op } = require('sequelize');

class BusinessRulesValidator {
  
  // Validate if an episode can be moved based on business rules
  async validateEpisodeMove({
    episode,
    newStartTime,
    newEndTime,
    facilityId,
    userId
  }) {
    const violations = [];
    const warnings = [];

    try {
      // Rule 1: Cannot move past episodes
      if (new Date(episode.episode_start_date_time) < new Date()) {
        violations.push({
          type: 'business_rule',
          rule: 'past_episode',
          severity: 'error',
          title: 'Past Episode',
          description: 'Cannot move episodes that have already started'
        });
      }

      // Rule 2: Cannot move to past dates
      if (new Date(newStartTime) < new Date()) {
        violations.push({
          type: 'business_rule',
          rule: 'past_date',
          severity: 'error',
          title: 'Past Date',
          description: 'Cannot move episodes to past dates'
        });
      }

      // Rule 3: Cannot move booked episodes
      if (episode.episode_status === 'booked') {
        violations.push({
          type: 'business_rule',
          rule: 'booked_episode',
          severity: 'error',
          title: 'Booked Episode',
          description: 'Cannot move episodes that are already booked'
        });
      }

      // Rule 4: Cannot move episodes with active bookings
      const activeBookings = await this.checkActiveBookings(episode.episode_id);
      if (activeBookings.length > 0) {
        violations.push({
          type: 'business_rule',
          rule: 'active_bookings',
          severity: 'error',
          title: 'Active Bookings',
          description: `Episode has ${activeBookings.length} active booking(s)`,
          details: activeBookings.map(b => `Booking #${b.booking_id} (${b.booking_status})`)
        });
      }

      // Rule 5: Validate advance booking window
      const advanceBookingResult = await this.validateAdvanceBookingWindow(
        episode, newStartTime, facilityId
      );
      warnings.push(...advanceBookingResult.warnings);
      violations.push(...advanceBookingResult.violations);

      // Rule 6: Validate minimum advance notice for changes
      const advanceNoticeResult = this.validateAdvanceNotice(episode, newStartTime);
      warnings.push(...advanceNoticeResult.warnings);

      // Rule 7: Check facility-specific rules
      const facilityRulesResult = await this.validateFacilityRules(
        episode, newStartTime, newEndTime, facilityId
      );
      warnings.push(...facilityRulesResult.warnings);
      violations.push(...facilityRulesResult.violations);

      // Rule 8: Validate user permissions for time changes
      const permissionResult = await this.validateMovePermissions(
        episode, newStartTime, newEndTime, userId
      );
      violations.push(...permissionResult.violations);

      // Rule 9: Check for maintenance windows
      const maintenanceResult = await this.checkMaintenanceWindows(
        newStartTime, newEndTime, facilityId
      );
      warnings.push(...maintenanceResult.warnings);
      violations.push(...maintenanceResult.violations);

    } catch (error) {
      console.error('Business rules validation error:', error);
      violations.push({
        type: 'business_rule',
        rule: 'validation_error',
        severity: 'error',
        title: 'Validation Error',
        description: 'Unable to validate business rules'
      });
    }

    return { violations, warnings };
  }

  // Check for active bookings
  async checkActiveBookings(episodeId) {
    try {
      return await Booking.findAll({
        where: {
          episode_id: episodeId,
          booking_status: {
            [Op.in]: ['pending', 'approved']
          }
        },
        include: [{
          model: Program,
          as: 'program',
          attributes: ['program_name']
        }]
      });
    } catch (error) {
      console.error('Check active bookings error:', error);
      return [];
    }
  }

  // Validate advance booking window
  async validateAdvanceBookingWindow(episode, newStartTime, facilityId) {
    const violations = [];
    const warnings = [];

    try {
      // Get facility advance booking settings
      const facility = await require('../models').Facility.findByPk(facilityId);
      const advanceBookingDays = facility?.advance_booking_days || 90;

      const now = new Date();
      const maxAdvanceDate = new Date(now.getTime() + (advanceBookingDays * 24 * 60 * 60 * 1000));
      const newStart = new Date(newStartTime);

      if (newStart > maxAdvanceDate) {
        violations.push({
          type: 'business_rule',
          rule: 'advance_booking_limit',
          severity: 'error',
          title: 'Advance Booking Limit',
          description: `Cannot book more than ${advanceBookingDays} days in advance`,
          maxDate: maxAdvanceDate.toDateString()
        });
      }

      // Warning for very advance bookings (80% of limit)
      const warningThreshold = new Date(now.getTime() + (advanceBookingDays * 0.8 * 24 * 60 * 60 * 1000));
      if (newStart > warningThreshold) {
        warnings.push({
          type: 'business_rule',
          rule: 'advance_booking_warning',
          severity: 'warning',
          title: 'Advance Booking',
          description: `Booking is ${Math.round((newStart - now) / (24 * 60 * 60 * 1000))} days in advance`
        });
      }

    } catch (error) {
      console.error('Advance booking validation error:', error);
    }

    return { violations, warnings };
  }

  // Validate advance notice for changes
  validateAdvanceNotice(episode, newStartTime) {
    const warnings = [];

    try {
      const originalStart = new Date(episode.episode_start_date_time);
      const now = new Date();
      const hoursUntilOriginal = (originalStart - now) / (1000 * 60 * 60);

      // Warning if changing within 24 hours
      if (hoursUntilOriginal < 24) {
        warnings.push({
          type: 'business_rule',
          rule: 'short_notice_change',
          severity: 'warning',
          title: 'Short Notice Change',
          description: `Changing ice time with only ${Math.round(hoursUntilOriginal)} hours notice`,
          originalTime: this.formatDateTime(originalStart)
        });
      }

      // Warning if moving to very soon
      const newStart = new Date(newStartTime);
      const hoursUntilNew = (newStart - now) / (1000 * 60 * 60);

      if (hoursUntilNew < 24) {
        warnings.push({
          type: 'business_rule',
          rule: 'short_notice_booking',
          severity: 'warning',
          title: 'Short Notice Booking',
          description: `New ice time is only ${Math.round(hoursUntilNew)} hours away`,
          newTime: this.formatDateTime(newStart)
        });
      }

    } catch (error) {
      console.error('Advance notice validation error:', error);
    }

    return { warnings };
  }

  // Validate facility-specific rules
  async validateFacilityRules(episode, newStartTime, newEndTime, facilityId) {
    const violations = [];
    const warnings = [];

    try {
      const facility = await require('../models').Facility.findByPk(facilityId);
      
      if (!facility) {
        violations.push({
          type: 'business_rule',
          rule: 'facility_not_found',
          severity: 'error',
          title: 'Facility Not Found',
          description: 'Cannot validate facility rules'
        });
        return { violations, warnings };
      }

      // Check minimum booking duration
      const duration = (new Date(newEndTime) - new Date(newStartTime)) / (1000 * 60);
      const minDuration = facility.min_booking_duration || 60;
      const maxDuration = facility.max_booking_duration || 180;

      if (duration < minDuration) {
        violations.push({
          type: 'business_rule',
          rule: 'min_duration',
          severity: 'error',
          title: 'Minimum Duration',
          description: `Ice time must be at least ${minDuration} minutes`,
          currentDuration: `${duration} minutes`
        });
      }

      if (duration > maxDuration) {
        violations.push({
          type: 'business_rule',
          rule: 'max_duration',
          severity: 'error',
          title: 'Maximum Duration',
          description: `Ice time cannot exceed ${maxDuration} minutes`,
          currentDuration: `${duration} minutes`
        });
      }

      // Check cancellation policy
      const cancellationHours = facility.cancellation_hours || 24;
      const originalStart = new Date(episode.episode_start_date_time);
      const now = new Date();
      const hoursUntilOriginal = (originalStart - now) / (1000 * 60 * 60);

      if (hoursUntilOriginal < cancellationHours) {
        warnings.push({
          type: 'business_rule',
          rule: 'cancellation_policy',
          severity: 'warning',
          title: 'Cancellation Policy',
          description: `Changes within ${cancellationHours} hours may incur fees`,
          hoursRemaining: Math.round(hoursUntilOriginal)
        });
      }

    } catch (error) {
      console.error('Facility rules validation error:', error);
    }

    return { violations, warnings };
  }

  // Validate user permissions for moves
  async validateMovePermissions(episode, newStartTime, newEndTime, userId) {
    const violations = [];

    try {
      // Get user information
      const user = await require('../models').User.findByPk(userId);
      
      if (!user) {
        violations.push({
          type: 'business_rule',
          rule: 'user_not_found',
          severity: 'error',
          title: 'User Not Found',
          description: 'Cannot validate user permissions'
        });
        return { violations };
      }

      // Only admins can move episodes for now
      if (user.user_type !== 'admin') {
        violations.push({
          type: 'business_rule',
          rule: 'insufficient_permissions',
          severity: 'error',
          title: 'Insufficient Permissions',
          description: 'Only administrators can move ice time slots'
        });
      }

      // Check if moving to a different day (might require special permission)
      const originalDate = new Date(episode.episode_start_date_time).toDateString();
      const newDate = new Date(newStartTime).toDateString();

      if (originalDate !== newDate) {
        // This could be a warning for complex moves
        // For now, we allow it for admins
      }

    } catch (error) {
      console.error('Permission validation error:', error);
    }

    return { violations };
  }

  // Check for maintenance windows
  async checkMaintenanceWindows(newStartTime, newEndTime, facilityId) {
    const violations = [];
    const warnings = [];

    try {
      // Check facility maintenance schedule
      const facility = await require('../models').Facility.findByPk(facilityId);
      
      if (facility && facility.maintenance_schedule) {
        const maintenanceSchedule = facility.maintenance_schedule;
        const newStart = new Date(newStartTime);
        const newEnd = new Date(newEndTime);

        // Check daily maintenance windows
        if (maintenanceSchedule.daily) {
          for (const window of maintenanceSchedule.daily) {
            if (this.timeOverlapsMaintenanceWindow(newStart, newEnd, window)) {
              violations.push({
                type: 'business_rule',
                rule: 'maintenance_window',
                severity: 'error',
                title: 'Maintenance Window',
                description: `Conflicts with daily maintenance: ${window.start} - ${window.end}`,
                maintenanceType: 'daily'
              });
            }
          }
        }

        // Check weekly maintenance
        if (maintenanceSchedule.weekly) {
          const dayOfWeek = newStart.getDay();
          const weeklyMaintenance = maintenanceSchedule.weekly[dayOfWeek];
          
          if (weeklyMaintenance) {
            for (const window of weeklyMaintenance) {
              if (this.timeOverlapsMaintenanceWindow(newStart, newEnd, window)) {
                warnings.push({
                  type: 'business_rule',
                  rule: 'weekly_maintenance',
                  severity: 'warning',
                  title: 'Weekly Maintenance',
                  description: `Overlaps with weekly maintenance: ${window.start} - ${window.end}`,
                  maintenanceType: 'weekly'
                });
              }
            }
          }
        }
      }

    } catch (error) {
      console.error('Maintenance window check error:', error);
    }

    return { violations, warnings };
  }

  // Helper method to check time overlap with maintenance window
  timeOverlapsMaintenanceWindow(startTime, endTime, maintenanceWindow) {
    try {
      const startTimeStr = startTime.toTimeString().slice(0, 5); // HH:MM format
      const endTimeStr = endTime.toTimeString().slice(0, 5);
      
      const maintStart = maintenanceWindow.start;
      const maintEnd = maintenanceWindow.end;

      // Simple time overlap check (assumes same day)
      return (startTimeStr < maintEnd && endTimeStr > maintStart);
    } catch (error) {
      console.error('Time overlap check error:', error);
      return false;
    }
  }

  // Validate episode creation rules
  async validateEpisodeCreation({
    startTime,
    endTime,
    resourceId,
    facilityId,
    userId
  }) {
    const violations = [];
    const warnings = [];

    // Apply similar rules as moves but for creation
    // This method can be expanded based on business needs

    return { violations, warnings };
  }

  // Utility method to format date/time
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

  // Get business rule configuration
  getBusinessRuleConfig() {
    return {
      minBookingDuration: 30, // minutes
      maxBookingDuration: 480, // minutes (8 hours)
      defaultAdvanceBookingDays: 90,
      defaultCancellationHours: 24,
      minAdvanceNoticeHours: 2
    };
  }

  // Validate all rules for a batch of moves
  async validateBatchMoves(moves, userId) {
    const results = [];

    for (const move of moves) {
      try {
        const episode = await require('../models').Episode.findByPk(move.episodeId);
        
        if (!episode) {
          results.push({
            episodeId: move.episodeId,
            violations: [{
              type: 'business_rule',
              rule: 'episode_not_found',
              severity: 'error',
              title: 'Episode Not Found',
              description: 'Episode does not exist'
            }],
            warnings: []
          });
          continue;
        }

        const validation = await this.validateEpisodeMove({
          episode,
          newStartTime: move.newStartTime,
          newEndTime: move.newEndTime,
          facilityId: move.facilityId,
          userId
        });

        results.push({
          episodeId: move.episodeId,
          ...validation
        });

      } catch (error) {
        console.error(`Batch validation error for episode ${move.episodeId}:`, error);
        results.push({
          episodeId: move.episodeId,
          violations: [{
            type: 'business_rule',
            rule: 'validation_error',
            severity: 'error',
            title: 'Validation Error',
            description: 'Unable to validate business rules'
          }],
          warnings: []
        });
      }
    }

    return results;
  }
}

module.exports = new BusinessRulesValidator();