// backend/src/utils/timezoneUtils.js (Simplified for Phase 3B)
class TimezoneUtils {
  
  // Default timezone for facilities
  static DEFAULT_TIMEZONE = 'America/Chicago';

  // Convert UTC datetime to facility timezone (simplified)
  static convertToFacilityTime(utcDateTime, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!utcDateTime) return null;
    
    try {
      // Simplified conversion - just return the date object
      // In production, would use moment-timezone or similar
      return new Date(utcDateTime);
    } catch (error) {
      console.warn('Facility timezone conversion failed:', error);
      return new Date(utcDateTime);
    }
  }

  // Convert facility timezone datetime to UTC (simplified)
  static convertToUTC(facilityDateTime, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!facilityDateTime) return null;
    
    try {
      // Simplified conversion
      return new Date(facilityDateTime);
    } catch (error) {
      console.warn('UTC conversion failed:', error);
      return new Date(facilityDateTime);
    }
  }

  // Parse datetime string and convert to UTC for database storage
  static parseAndConvertToUTC(dateTimeString, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!dateTimeString) return null;
    
    try {
      return new Date(dateTimeString);
    } catch (error) {
      console.error('Parse and convert to UTC failed:', error);
      return null;
    }
  }

  // Format datetime for display in facility timezone
  static formatForDisplay(utcDateTime, facilityTimezone = this.DEFAULT_TIMEZONE, format = 'en-US') {
    if (!utcDateTime) return null;
    
    try {
      return new Date(utcDateTime).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: facilityTimezone
      });
    } catch (error) {
      console.warn('Display format failed:', error);
      return new Date(utcDateTime).toLocaleString('en-US');
    }
  }

  // Get current time in facility timezone
  static getCurrentTime(facilityTimezone = this.DEFAULT_TIMEZONE) {
    try {
      return new Date();
    } catch (error) {
      console.warn('Get current time failed:', error);
      return new Date();
    }
  }

  // Calculate duration between two dates in minutes
  static calculateDurationWithDST(startTime, endTime, facilityTimezone = this.DEFAULT_TIMEZONE) {
    try {
      return Math.round((new Date(endTime) - new Date(startTime)) / (1000 * 60));
    } catch (error) {
      console.error('Duration calculation failed:', error);
      return 60; // Default to 1 hour
    }
  }

  // Get timezone offset in minutes
  static getTimezoneOffset(facilityTimezone = this.DEFAULT_TIMEZONE) {
    try {
      return new Date().getTimezoneOffset();
    } catch (error) {
      console.warn('Get timezone offset failed:', error);
      return 0;
    }
  }

  // Get timezone abbreviation
  static getTimezoneAbbreviation(facilityTimezone = this.DEFAULT_TIMEZONE) {
    try {
      return new Date().toLocaleString('en-US', {
        timeZone: facilityTimezone,
        timeZoneName: 'short'
      }).split(' ').pop();
    } catch (error) {
      console.warn('Get timezone abbreviation failed:', error);
      return 'UTC';
    }
  }

  // Validate timezone string
  static isValidTimezone(timezone) {
    try {
      new Date().toLocaleString('en-US', { timeZone: timezone });
      return true;
    } catch (error) {
      return false;
    }
  }

  // Format time range for display
  static formatTimeRange(startTime, endTime, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!startTime || !endTime) return 'Invalid time range';
    
    try {
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      const startStr = start.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: facilityTimezone
      });
      
      const endStr = end.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: facilityTimezone
      });
      
      return `${startStr} - ${endStr}`;
    } catch (error) {
      console.error('Format time range failed:', error);
      return 'Invalid time range';
    }
  }

  // Convert episode times for API response
  static convertEpisodeTimesForAPI(episode, targetTimezone = null) {
    if (!episode || !targetTimezone) return episode;
    
    try {
      const convertedEpisode = {
        ...episode.toJSON ? episode.toJSON() : episode
      };

      // For now, just return as-is since we're using simplified timezone handling
      return convertedEpisode;
    } catch (error) {
      console.error('Convert episode times failed:', error);
      return episode;
    }
  }

  // Get human-readable timezone display name
  static getTimezoneDisplayName(facilityTimezone = this.DEFAULT_TIMEZONE) {
    try {
      const now = new Date();
      const abbreviation = now.toLocaleString('en-US', {
        timeZone: facilityTimezone,
        timeZoneName: 'short'
      }).split(' ').pop();
      
      return abbreviation;
    } catch (error) {
      console.warn('Get timezone display name failed:', error);
      return facilityTimezone;
    }
  }

  // Check if time change crosses DST boundary (simplified)
  static crossesDSTBoundary(originalTime, newTime, facilityTimezone = this.DEFAULT_TIMEZONE) {
    // Simplified implementation - in production would check actual DST boundaries
    return false;
  }

  // Validate that a time is reasonable for ice time booking
  static validateIceTimeHours(dateTime, facilityTimezone = this.DEFAULT_TIMEZONE) {
    try {
      const hour = new Date(dateTime).getHours();
      
      // Ice arenas typically operate between 5 AM and 11 PM
      const isReasonableHour = hour >= 5 && hour <= 23;
      
      return {
        isValid: isReasonableHour,
        warning: isReasonableHour ? null : 'This time is outside typical arena operating hours',
        hour,
        facilityTimezone
      };
    } catch (error) {
      console.error('Validate ice time hours failed:', error);
      return { isValid: true, warning: null };
    }
  }

  // Get list of supported timezones for US facilities
  static getSupportedTimezones() {
    return [
      { value: 'America/New_York', label: 'Eastern Time (ET)', offset: 'UTC-5/-4' },
      { value: 'America/Chicago', label: 'Central Time (CT)', offset: 'UTC-6/-5' },
      { value: 'America/Denver', label: 'Mountain Time (MT)', offset: 'UTC-7/-6' },
      { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: 'UTC-8/-7' },
      { value: 'America/Anchorage', label: 'Alaska Time (AKT)', offset: 'UTC-9/-8' },
      { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)', offset: 'UTC-10' }
    ];
  }
}

module.exports = TimezoneUtils;