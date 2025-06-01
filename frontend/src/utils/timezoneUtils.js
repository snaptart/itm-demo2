// backend/src/utils/timezoneUtils.js
const moment = require('moment-timezone');

class TimezoneUtils {
  
  // Default timezone for facilities
  static DEFAULT_TIMEZONE = 'America/Chicago';

  // Convert UTC datetime to facility timezone
  static convertToFacilityTime(utcDateTime, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!utcDateTime) return null;
    
    try {
      return moment.utc(utcDateTime).tz(facilityTimezone);
    } catch (error) {
      console.warn('Facility timezone conversion failed:', error);
      return moment.utc(utcDateTime);
    }
  }

  // Convert facility timezone datetime to UTC
  static convertToUTC(facilityDateTime, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!facilityDateTime) return null;
    
    try {
      return moment.tz(facilityDateTime, facilityTimezone).utc();
    } catch (error) {
      console.warn('UTC conversion failed:', error);
      return moment(facilityDateTime).utc();
    }
  }

  // Parse datetime string and convert to UTC for database storage
  static parseAndConvertToUTC(dateTimeString, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!dateTimeString) return null;
    
    try {
      // If the string already has timezone info, use it
      if (dateTimeString.includes('T') && (dateTimeString.includes('Z') || dateTimeString.includes('+'))) {
        return moment(dateTimeString).utc().toDate();
      }
      
      // Otherwise, treat as facility local time and convert to UTC
      return moment.tz(dateTimeString, facilityTimezone).utc().toDate();
    } catch (error) {
      console.error('Parse and convert to UTC failed:', error);
      return null;
    }
  }

  // Format datetime for display in facility timezone
  static formatForDisplay(utcDateTime, facilityTimezone = this.DEFAULT_TIMEZONE, format = 'YYYY-MM-DD HH:mm:ss z') {
    if (!utcDateTime) return null;
    
    try {
      return moment.utc(utcDateTime).tz(facilityTimezone).format(format);
    } catch (error) {
      console.warn('Display format failed:', error);
      return moment.utc(utcDateTime).format(format);
    }
  }

  // Get current time in facility timezone
  static getCurrentTime(facilityTimezone = this.DEFAULT_TIMEZONE) {
    try {
      return moment().tz(facilityTimezone);
    } catch (error) {
      console.warn('Get current time failed:', error);
      return moment();
    }
  }

  // Check if datetime is in business hours for facility
  static isWithinBusinessHours(dateTime, facilityTimezone, businessHours) {
    if (!dateTime || !businessHours) return true;
    
    try {
      const facilityTime = this.convertToFacilityTime(dateTime, facilityTimezone);
      const dayOfWeek = facilityTime.day(); // 0 = Sunday, 6 = Saturday
      const timeOfDay = facilityTime.format('HH:mm');
      
      // Check if facility is open on this day
      const dayHours = businessHours[dayOfWeek];
      if (!dayHours || dayHours.isClosed) {
        return false;
      }
      
      // Check if time is within operating hours
      return timeOfDay >= dayHours.openTime && timeOfDay <= dayHours.closeTime;
    } catch (error) {
      console.error('Business hours check failed:', error);
      return true; // Default to allowing if check fails
    }
  }

  // Get timezone offset in minutes
  static getTimezoneOffset(facilityTimezone = this.DEFAULT_TIMEZONE) {
    try {
      return moment().tz(facilityTimezone).utcOffset();
    } catch (error) {
      console.warn('Get timezone offset failed:', error);
      return 0;
    }
  }

  // Validate timezone string
  static isValidTimezone(timezone) {
    try {
      moment.tz.zone(timezone);
      return true;
    } catch (error) {
      return false;
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

  // Convert episode times for API response based on user preference
  static convertEpisodeTimesForAPI(episode, targetTimezone = null) {
    if (!episode || !targetTimezone) return episode;
    
    try {
      return {
        ...episode,
        episode_start_date_time: this.convertToFacilityTime(
          episode.episode_start_date_time, 
          targetTimezone
        ).toISOString(),
        episode_end_date_time: this.convertToFacilityTime(
          episode.episode_end_date_time, 
          targetTimezone
        ).toISOString(),
        displayStartTime: this.formatForDisplay(
          episode.episode_start_date_time, 
          targetTimezone, 
          'MMM D, YYYY h:mm A z'
        ),
        displayEndTime: this.formatForDisplay(
          episode.episode_end_date_time, 
          targetTimezone, 
          'h:mm A z'
        )
      };
    } catch (error) {
      console.error('Convert episode times failed:', error);
      return episode;
    }
  }

  // Calculate duration accounting for DST changes
  static calculateDurationWithDST(startTime, endTime, facilityTimezone = this.DEFAULT_TIMEZONE) {
    try {
      const start = moment.utc(startTime).tz(facilityTimezone);
      const end = moment.utc(endTime).tz(facilityTimezone);
      return end.diff(start, 'minutes');
    } catch (error) {
      console.error('Duration calculation with DST failed:', error);
      return Math.round((new Date(endTime) - new Date(startTime)) / (1000 * 60));
    }
  }

  // Round time to nearest interval in facility timezone
  static roundToInterval(dateTime, intervalMinutes = 15, facilityTimezone = this.DEFAULT_TIMEZONE) {
    try {
      const facilityTime = this.convertToFacilityTime(dateTime, facilityTimezone);
      const minutes = facilityTime.minutes();
      const remainder = minutes % intervalMinutes;
      
      if (remainder === 0) {
        return this.convertToUTC(facilityTime, facilityTimezone).toDate();
      }
      
      if (remainder < intervalMinutes / 2) {
        facilityTime.subtract(remainder, 'minutes');
      } else {
        facilityTime.add(intervalMinutes - remainder, 'minutes');
      }
      
      facilityTime.seconds(0).milliseconds(0);
      
      return this.convertToUTC(facilityTime, facilityTimezone).toDate();
    } catch (error) {
      console.error('Round to interval failed:', error);
      return dateTime;
    }
  }

  // Check if time change crosses DST boundary
  static crossesDSTBoundary(originalTime, newTime, facilityTimezone = this.DEFAULT_TIMEZONE) {
    try {
      const originalFacilityTime = this.convertToFacilityTime(originalTime, facilityTimezone);
      const newFacilityTime = this.convertToFacilityTime(newTime, facilityTimezone);
      
      return originalFacilityTime.isDST() !== newFacilityTime.isDST();
    } catch (error) {
      console.error('DST boundary check failed:', error);
      return false;
    }
  }

  // Get DST information for a facility
  static getDSTInfo(facilityTimezone = this.DEFAULT_TIMEZONE) {
    try {
      const now = moment().tz(facilityTimezone);
      const zoneName = now.format('z');
      const offset = now.format('Z');
      const isDST = now.isDST();
      
      return {
        zoneName,
        offset,
        isDST,
        timezone: facilityTimezone
      };
    } catch (error) {
      console.error('Get DST info failed:', error);
      return {
        zoneName: 'Unknown',
        offset: '+00:00',
        isDST: false,
        timezone: facilityTimezone
      };
    }
  }

  // Format time range for display
  static formatTimeRange(startTime, endTime, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!startTime || !endTime) return 'Invalid time range';
    
    try {
      const start = this.convertToFacilityTime(startTime, facilityTimezone);
      const end = this.convertToFacilityTime(endTime, facilityTimezone);
      
      // If same day, show: "Mar 15, 2024 2:00 PM - 4:00 PM CT"
      if (start.isSame(end, 'day')) {
        return `${start.format('MMM D, YYYY h:mm A')} - ${end.format('h:mm A z')}`;
      }
      
      // If different days, show full dates
      return `${start.format('MMM D, YYYY h:mm A z')} - ${end.format('MMM D, YYYY h:mm A z')}`;
    } catch (error) {
      console.error('Format time range failed:', error);
      return 'Invalid time range';
    }
  }

  // Validate that a time is reasonable for ice time booking
  static validateIceTimeHours(dateTime, facilityTimezone = this.DEFAULT_TIMEZONE) {
    try {
      const facilityTime = this.convertToFacilityTime(dateTime, facilityTimezone);
      const hour = facilityTime.hour();
      
      // Ice arenas typically operate between 5 AM and 11 PM
      const isReasonableHour = hour >= 5 && hour <= 23;
      
      return {
        isValid: isReasonableHour,
        warning: isReasonableHour ? null : 'This time is outside typical arena operating hours'
      };
    } catch (error) {
      console.error('Validate ice time hours failed:', error);
      return { isValid: true, warning: null };
    }
  }
}

module.exports = TimezoneUtils;