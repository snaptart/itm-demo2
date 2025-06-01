// backend/src/utils/timezoneUtils.js (Enhanced)
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

  // Create UTC datetime from separate date and time strings in facility timezone
  static createUTCFromFacilityDateTime(dateString, timeString, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!dateString || !timeString) return null;
    
    try {
      const dateTimeString = `${dateString} ${timeString}`;
      return moment.tz(dateTimeString, 'YYYY-MM-DD HH:mm', facilityTimezone).utc().toDate();
    } catch (error) {
      console.error('Create UTC from facility datetime failed:', error);
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

  // Validate facility business hours for datetime range
  static validateBusinessHours(startDateTime, endDateTime, facility, facilityTimezone = this.DEFAULT_TIMEZONE) {
    const violations = [];
    const warnings = [];

    try {
      const startTime = this.convertToFacilityTime(startDateTime, facilityTimezone);
      const endTime = this.convertToFacilityTime(endDateTime, facilityTimezone);

      // Check daily hours
      const dailyStart = facility.facility_daily_start_time || '06:00:00';
      const dailyEnd = facility.facility_daily_end_time || '23:00:00';

      const startTimeStr = startTime.format('HH:mm:ss');
      const endTimeStr = endTime.format('HH:mm:ss');

      if (startTimeStr < dailyStart || endTimeStr > dailyEnd) {
        violations.push({
          type: 'business_hours',
          severity: 'error',
          title: 'Outside Business Hours',
          description: `Facility hours are ${dailyStart.slice(0, 5)} - ${dailyEnd.slice(0, 5)} (${this.getTimezoneAbbreviation(facilityTimezone)})`,
          facilityTimezone,
          requestedTime: this.formatTimeRange(startDateTime, endDateTime, facilityTimezone)
        });
      }

      // Check for unusual hours (before 6 AM or after 10 PM)
      const startHour = startTime.hour();
      const endHour = endTime.hour();

      if (startHour < 6 || endHour > 22) {
        warnings.push({
          type: 'unusual_hours',
          severity: 'warning',
          title: 'Unusual Hours',
          description: 'This time is outside typical arena operating hours',
          facilityTimezone
        });
      }

    } catch (error) {
      console.error('Business hours validation failed:', error);
      violations.push({
        type: 'validation_error',
        severity: 'error',
        title: 'Validation Error',
        description: 'Unable to validate business hours'
      });
    }

    return { violations, warnings };
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

  // Get timezone abbreviation (e.g., "CST", "EST")
  static getTimezoneAbbreviation(facilityTimezone = this.DEFAULT_TIMEZONE) {
    try {
      return moment().tz(facilityTimezone).format('z');
    } catch (error) {
      console.warn('Get timezone abbreviation failed:', error);
      return 'UTC';
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
      const convertedEpisode = {
        ...episode.toJSON ? episode.toJSON() : episode
      };

      // Convert main datetime fields
      if (convertedEpisode.episode_start_date_time) {
        convertedEpisode.episode_start_date_time = this.convertToFacilityTime(
          convertedEpisode.episode_start_date_time, 
          targetTimezone
        ).toISOString();
      }

      if (convertedEpisode.episode_end_date_time) {
        convertedEpisode.episode_end_date_time = this.convertToFacilityTime(
          convertedEpisode.episode_end_date_time, 
          targetTimezone
        ).toISOString();
      }

      // Add display fields
      convertedEpisode.displayStartTime = this.formatForDisplay(
        episode.episode_start_date_time, 
        targetTimezone, 
        'MMM D, YYYY h:mm A z'
      );

      convertedEpisode.displayEndTime = this.formatForDisplay(
        episode.episode_end_date_time, 
        targetTimezone, 
        'h:mm A z'
      );

      convertedEpisode.facilityTimezone = targetTimezone;

      return convertedEpisode;
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
        timezone: facilityTimezone,
        displayName: this.getTimezoneDisplayName(facilityTimezone)
      };
    } catch (error) {
      console.error('Get DST info failed:', error);
      return {
        zoneName: 'Unknown',
        offset: '+00:00',
        isDST: false,
        timezone: facilityTimezone,
        displayName: facilityTimezone
      };
    }
  }

  // Get human-readable timezone display name
  static getTimezoneDisplayName(facilityTimezone = this.DEFAULT_TIMEZONE) {
    try {
      const now = moment().tz(facilityTimezone);
      const abbreviation = now.format('z');
      const offset = now.format('Z');
      return `${abbreviation} (UTC${offset})`;
    } catch (error) {
      console.warn('Get timezone display name failed:', error);
      return facilityTimezone;
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
        warning: isReasonableHour ? null : 'This time is outside typical arena operating hours',
        hour,
        facilityTimezone
      };
    } catch (error) {
      console.error('Validate ice time hours failed:', error);
      return { isValid: true, warning: null };
    }
  }

  // Parse flexible time input formats
  static parseTimeInput(timeString, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!timeString) return null;

    try {
      // Handle various time formats
      const formats = [
        'HH:mm',
        'H:mm', 
        'h:mm A',
        'h:mmA',
        'h A',
        'hA'
      ];

      for (const format of formats) {
        const parsed = moment(timeString, format, true);
        if (parsed.isValid()) {
          return parsed.format('HH:mm');
        }
      }

      // Fallback: try to parse as-is
      const fallback = moment(timeString, 'HH:mm');
      if (fallback.isValid()) {
        return fallback.format('HH:mm');
      }

      return null;
    } catch (error) {
      console.error('Parse time input failed:', error);
      return null;
    }
  }

  // Check for timezone conflicts in scheduling
  static checkTimezoneConflicts(startTime, endTime, facilityTimezone = this.DEFAULT_TIMEZONE) {
    const conflicts = [];

    try {
      // Check for DST boundaries
      if (this.crossesDSTBoundary(startTime, endTime, facilityTimezone)) {
        conflicts.push({
          type: 'dst_boundary',
          severity: 'warning',
          title: 'Daylight Saving Time Change',
          description: 'This scheduling crosses a daylight saving time boundary',
          facilityTimezone
        });
      }

      // Check for midnight crossing
      const start = this.convertToFacilityTime(startTime, facilityTimezone);
      const end = this.convertToFacilityTime(endTime, facilityTimezone);

      if (!start.isSame(end, 'day')) {
        conflicts.push({
          type: 'midnight_crossing',
          severity: 'warning',
          title: 'Date Change',
          description: 'This ice time crosses into the next day',
          facilityTimezone
        });
      }

    } catch (error) {
      console.error('Check timezone conflicts failed:', error);
    }

    return conflicts;
  }

  // Get facility business day info
  static getFacilityDayInfo(dateTime, facilityTimezone = this.DEFAULT_TIMEZONE) {
    try {
      const facilityTime = this.convertToFacilityTime(dateTime, facilityTimezone);
      
      return {
        dayOfWeek: facilityTime.day(), // 0 = Sunday
        dayName: facilityTime.format('dddd'),
        date: facilityTime.format('YYYY-MM-DD'),
        isWeekend: facilityTime.day() === 0 || facilityTime.day() === 6,
        facilityTimezone
      };
    } catch (error) {
      console.error('Get facility day info failed:', error);
      return null;
    }
  }

  // Middleware function for Express to handle timezone conversion
  static createTimezoneMiddleware() {
    return (req, res, next) => {
      // Add timezone utilities to request object
      req.timezone = {
        convert: this.convertToFacilityTime.bind(this),
        parseUTC: this.parseAndConvertToUTC.bind(this),
        format: this.formatForDisplay.bind(this),
        validate: this.isValidTimezone.bind(this)
      };

      // Add timezone conversion to response helpers
      const originalJson = res.json;
      res.json = function(data) {
        // Auto-convert episode times if client timezone is specified
        if (req.headers['x-client-timezone'] && data) {
          if (data.episode || data.episodes) {
            // Handle episode data conversion
            data = TimezoneUtils.convertResponseTimezones(data, req.headers['x-client-timezone']);
          }
        }
        return originalJson.call(this, data);
      };

      next();
    };
  }

  // Convert response data timezones
  static convertResponseTimezones(data, clientTimezone) {
    try {
      if (data.episode) {
        data.episode = this.convertEpisodeTimesForAPI(data.episode, clientTimezone);
      }
      
      if (data.episodes && Array.isArray(data.episodes)) {
        data.episodes = data.episodes.map(episode => 
          this.convertEpisodeTimesForAPI(episode, clientTimezone)
        );
      }

      if (data.events && Array.isArray(data.events)) {
        data.events = data.events.map(event => {
          if (event.extendedProps && event.extendedProps.facilityTimezone) {
            // Convert FullCalendar event times
            event.start = this.convertToFacilityTime(event.start, clientTimezone).toISOString();
            event.end = this.convertToFacilityTime(event.end, clientTimezone).toISOString();
          }
          return event;
        });
      }

      return data;
    } catch (error) {
      console.error('Convert response timezones failed:', error);
      return data;
    }
  }
}

module.exports = TimezoneUtils;