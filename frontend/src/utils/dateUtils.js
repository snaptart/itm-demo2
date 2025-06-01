// frontend/src/utils/dateUtils.js (Enhanced with Timezone Support)

export const dateUtils = {
  // Default facility timezone (can be overridden per facility)
  DEFAULT_TIMEZONE: 'America/Chicago',

  // Format date for API calls (always UTC)
  formatForAPI(date) {
    if (!date) return null;
    return new Date(date).toISOString();
  },

  // Parse API date string (UTC) and convert to facility timezone for display
  parseFromAPI(dateString, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!dateString) return null;
    const utcDate = new Date(dateString);
    return this.convertToFacilityTime(utcDate, facilityTimezone);
  },

  // Convert UTC time to facility local time
  convertToFacilityTime(utcTime, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!utcTime) return null;
    
    try {
      // Create a new date in the facility's timezone
      const facilityTime = new Date(utcTime.toLocaleString('en-US', { 
        timeZone: facilityTimezone 
      }));
      return facilityTime;
    } catch (error) {
      console.warn('Timezone conversion failed:', error);
      return new Date(utcTime); // Fallback to original time
    }
  },

  // Convert facility local time to UTC for storage
  convertToUTC(facilityTime, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!facilityTime) return null;
    
    try {
      // Get the timezone offset for the facility
      const tempDate = new Date();
      const utcTime = new Date(tempDate.toLocaleString('en-US', { timeZone: 'UTC' }));
      const facilityTimeTemp = new Date(tempDate.toLocaleString('en-US', { timeZone: facilityTimezone }));
      const offset = utcTime.getTime() - facilityTimeTemp.getTime();
      
      // Apply offset to convert facility time to UTC
      return new Date(facilityTime.getTime() + offset);
    } catch (error) {
      console.warn('UTC conversion failed:', error);
      return new Date(facilityTime); // Fallback
    }
  },

  // Format date for display in facility timezone
  formatForDisplay(date, facilityTimezone = this.DEFAULT_TIMEZONE, options = {}) {
    if (!date) return 'N/A';
    
    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: facilityTimezone
    };

    try {
      return new Date(date).toLocaleString('en-US', { ...defaultOptions, ...options });
    } catch (error) {
      console.warn('Display format failed:', error);
      return new Date(date).toLocaleString('en-US', defaultOptions);
    }
  },

  // Format time only in facility timezone
  formatTimeOnly(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return 'N/A';
    
    try {
      return new Date(date).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: facilityTimezone
      });
    } catch (error) {
      console.warn('Time format failed:', error);
      return new Date(date).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
  },

  // Format date only in facility timezone
  formatDateOnly(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return 'N/A';
    
    try {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: facilityTimezone
      });
    } catch (error) {
      console.warn('Date format failed:', error);
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  },

  // Create date in facility timezone from date and time inputs
  createFacilityDateTime(dateStr, timeStr, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!dateStr || !timeStr) return null;
    
    try {
      // Combine date and time strings
      const dateTimeStr = `${dateStr}T${timeStr}:00`;
      
      // Create date as if it's in the facility timezone
      const localDate = new Date(dateTimeStr);
      
      // Convert to UTC for storage
      return this.convertToUTC(localDate, facilityTimezone);
    } catch (error) {
      console.error('Create facility datetime failed:', error);
      return null;
    }
  },

  // Extract date string for input fields (in facility timezone)
  extractDateString(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return '';
    
    try {
      const facilityTime = this.convertToFacilityTime(date, facilityTimezone);
      return facilityTime.toISOString().split('T')[0];
    } catch (error) {
      console.warn('Extract date string failed:', error);
      return new Date(date).toISOString().split('T')[0];
    }
  },

  // Extract time string for input fields (in facility timezone)
  extractTimeString(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return '';
    
    try {
      const facilityTime = this.convertToFacilityTime(date, facilityTimezone);
      return facilityTime.toTimeString().slice(0, 5); // HH:MM format
    } catch (error) {
      console.warn('Extract time string failed:', error);
      return new Date(date).toTimeString().slice(0, 5);
    }
  },

  // Check if date is in the past (considering facility timezone)
  isPast(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return false;
    
    const now = new Date();
    const facilityNow = this.convertToFacilityTime(now, facilityTimezone);
    const checkDate = this.convertToFacilityTime(new Date(date), facilityTimezone);
    
    return checkDate < facilityNow;
  },

  // Check if date is today (in facility timezone)
  isToday(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return false;
    
    const today = new Date();
    const facilityToday = this.convertToFacilityTime(today, facilityTimezone);
    const checkDate = this.convertToFacilityTime(new Date(date), facilityTimezone);
    
    return this.extractDateString(facilityToday, facilityTimezone) === 
           this.extractDateString(checkDate, facilityTimezone);
  },

  // Check if date is this week (in facility timezone)
  isThisWeek(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    const now = new Date();
    const facilityNow = this.convertToFacilityTime(now, facilityTimezone);
    const startOfWeek = new Date(facilityNow);
    startOfWeek.setDate(facilityNow.getDate() - facilityNow.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    const checkDate = this.convertToFacilityTime(new Date(date), facilityTimezone);
    return checkDate >= startOfWeek && checkDate <= endOfWeek;
  },

  // Add duration to date (preserving timezone context)
  addDuration(date, minutes, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return null;
    
    const facilityTime = this.convertToFacilityTime(new Date(date), facilityTimezone);
    facilityTime.setMinutes(facilityTime.getMinutes() + minutes);
    return this.convertToUTC(facilityTime, facilityTimezone);
  },

  // Calculate duration between two dates in minutes
  getDuration(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    return Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60));
  },

  // Round to nearest interval in facility timezone
  roundToInterval(date, intervalMinutes = 15, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return null;
    
    const facilityTime = this.convertToFacilityTime(new Date(date), facilityTimezone);
    const minutes = facilityTime.getMinutes();
    const remainder = minutes % intervalMinutes;
    
    if (remainder === 0) {
      return this.convertToUTC(facilityTime, facilityTimezone);
    }
    
    if (remainder < intervalMinutes / 2) {
      facilityTime.setMinutes(minutes - remainder);
    } else {
      facilityTime.setMinutes(minutes + (intervalMinutes - remainder));
    }
    
    facilityTime.setSeconds(0);
    facilityTime.setMilliseconds(0);
    
    return this.convertToUTC(facilityTime, facilityTimezone);
  },

  // Get start/end of day in facility timezone
  getStartOfDay(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return null;
    
    const facilityTime = this.convertToFacilityTime(new Date(date), facilityTimezone);
    facilityTime.setHours(0, 0, 0, 0);
    return this.convertToUTC(facilityTime, facilityTimezone);
  },

  getEndOfDay(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return null;
    
    const facilityTime = this.convertToFacilityTime(new Date(date), facilityTimezone);
    facilityTime.setHours(23, 59, 59, 999);
    return this.convertToUTC(facilityTime, facilityTimezone);
  },

  // Get start/end of week in facility timezone
  getStartOfWeek(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return null;
    
    const facilityTime = this.convertToFacilityTime(new Date(date), facilityTimezone);
    const day = facilityTime.getDay();
    facilityTime.setDate(facilityTime.getDate() - day);
    return this.getStartOfDay(facilityTime, facilityTimezone);
  },

  getEndOfWeek(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return null;
    
    const facilityTime = this.convertToFacilityTime(new Date(date), facilityTimezone);
    const day = facilityTime.getDay();
    facilityTime.setDate(facilityTime.getDate() + (6 - day));
    return this.getEndOfDay(facilityTime, facilityTimezone);
  },

  // Validate date range in facility timezone
  validateDateRange(startDate, endDate, facilityTimezone = this.DEFAULT_TIMEZONE) {
    const errors = [];
    
    if (!startDate) {
      errors.push('Start date is required');
      return { isValid: false, errors };
    }
    
    if (!endDate) {
      errors.push('End date is required');
      return { isValid: false, errors };
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime())) {
      errors.push('Invalid start date');
    }
    
    if (isNaN(end.getTime())) {
      errors.push('Invalid end date');
    }
    
    if (errors.length > 0) {
      return { isValid: false, errors };
    }
    
    if (start >= end) {
      errors.push('End date must be after start date');
    }
    
    if (this.isPast(start, facilityTimezone)) {
      errors.push('Start date cannot be in the past');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  },

  // Format duration for display
  formatDuration(minutes) {
    if (!minutes || minutes <= 0) return '0 min';
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) {
      return `${mins} min`;
    } else if (mins === 0) {
      return `${hours} hr`;
    } else {
      return `${hours} hr ${mins} min`;
    }
  },

  // Get relative time in facility timezone
  getRelativeTime(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return 'N/A';
    
    const now = new Date();
    const facilityNow = this.convertToFacilityTime(now, facilityTimezone);
    const facilityDate = this.convertToFacilityTime(new Date(date), facilityTimezone);
    const diffMs = facilityDate - facilityNow;
    const diffMins = Math.round(diffMs / (1000 * 60));
    
    if (diffMins < 0) {
      const pastMins = Math.abs(diffMins);
      if (pastMins < 60) {
        return `${pastMins} min ago`;
      } else if (pastMins < 1440) {
        const hours = Math.round(pastMins / 60);
        return `${hours} hr ago`;
      } else {
        const days = Math.round(pastMins / 1440);
        return `${days} day${days > 1 ? 's' : ''} ago`;
      }
    } else {
      if (diffMins < 60) {
        return `in ${diffMins} min`;
      } else if (diffMins < 1440) {
        const hours = Math.round(diffMins / 60);
        return `in ${hours} hr`;
      } else {
        const days = Math.round(diffMins / 1440);
        return `in ${days} day${days > 1 ? 's' : ''}`;
      }
    }
  },

  // Get timezone display name
  getTimezoneDisplayName(timezone) {
    try {
      const now = new Date();
      return now.toLocaleString('en-US', {
        timeZone: timezone,
        timeZoneName: 'short'
      }).split(' ').pop();
    } catch (error) {
      console.warn('Timezone display name failed:', error);
      return timezone;
    }
  },

  // Get common US timezones for facility configuration
  getCommonTimezones() {
    return [
      { value: 'America/New_York', label: 'Eastern Time (ET)' },
      { value: 'America/Chicago', label: 'Central Time (CT)' },
      { value: 'America/Denver', label: 'Mountain Time (MT)' },
      { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
      { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
      { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' }
    ];
  },

  // Validate timezone string
  isValidTimezone(timezone) {
    try {
      new Date().toLocaleString('en-US', { timeZone: timezone });
      return true;
    } catch (error) {
      return false;
    }
  }
};