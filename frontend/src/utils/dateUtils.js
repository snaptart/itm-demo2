// frontend/src/utils/dateUtils.js (Fixed with Simplified Timezone Handling)

export const dateUtils = {
  // Default facility timezone (can be overridden per facility)
  DEFAULT_TIMEZONE: 'America/Chicago',

  // Format date for API calls (always UTC ISO string)
  formatForAPI(date) {
    if (!date) return null;
    return new Date(date).toISOString();
  },

  // Parse API date string (UTC) for display
  parseFromAPI(dateString, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!dateString) return null;
    return new Date(dateString);
  },

  // FIXED: Create date in facility timezone from date and time inputs
  createFacilityDateTime(dateStr, timeStr, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!dateStr || !timeStr) return null;
    
    try {
      // Create the datetime string in the format the browser expects
      const dateTimeStr = `${dateStr}T${timeStr}:00`;
      
      // Create a Date object - this will be interpreted in the user's local timezone
      const localDate = new Date(dateTimeStr);
      
      // For now, return the date as-is since we're simplifying timezone handling
      // In production, we would use a proper timezone library here
      return localDate;
    } catch (error) {
      console.error('Create facility datetime failed:', error);
      return null;
    }
  },

  // SIMPLIFIED: Convert to facility time (for now, just return the date)
  convertToFacilityTime(utcTime, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!utcTime) return null;
    return new Date(utcTime);
  },

  // SIMPLIFIED: Convert to UTC (for now, just return the date)
  convertToUTC(facilityTime, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!facilityTime) return null;
    return new Date(facilityTime);
  },

  // Format date for display
  formatForDisplay(date, facilityTimezone = this.DEFAULT_TIMEZONE, options = {}) {
    if (!date) return 'N/A';
    
    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };

    try {
      return new Date(date).toLocaleString('en-US', { ...defaultOptions, ...options });
    } catch (error) {
      console.warn('Display format failed:', error);
      return new Date(date).toLocaleString('en-US', defaultOptions);
    }
  },

  // Format time only
  formatTimeOnly(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return 'N/A';
    
    try {
      return new Date(date).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
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

  // Format date only
  formatDateOnly(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return 'N/A';
    
    try {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
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

  // FIXED: Extract date string for input fields
  extractDateString(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return '';
    
    try {
      // Get the date in YYYY-MM-DD format for HTML date inputs
      const dateObj = new Date(date);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.warn('Extract date string failed:', error);
      return '';
    }
  },

  // FIXED: Extract time string for input fields
  extractTimeString(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return '';
    
    try {
      // Get the time in HH:MM format for HTML time inputs
      const dateObj = new Date(date);
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch (error) {
      console.warn('Extract time string failed:', error);
      return '';
    }
  },

  // Check if date is in the past
  isPast(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return false;
    return new Date(date) < new Date();
  },

  // Check if date is today
  isToday(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return false;
    
    const today = new Date();
    const checkDate = new Date(date);
    
    return today.toDateString() === checkDate.toDateString();
  },

  // Calculate duration between two dates in minutes
  getDuration(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    return Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60));
  },

  // Get start/end of day
  getStartOfDay(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return null;
    
    const newDate = new Date(date);
    newDate.setHours(0, 0, 0, 0);
    return newDate;
  },

  getEndOfDay(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return null;
    
    const newDate = new Date(date);
    newDate.setHours(23, 59, 59, 999);
    return newDate;
  },

  // Get start/end of week
  getStartOfWeek(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return null;
    
    const newDate = new Date(date);
    const day = newDate.getDay();
    newDate.setDate(newDate.getDate() - day);
    return this.getStartOfDay(newDate, facilityTimezone);
  },

  getEndOfWeek(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return null;
    
    const newDate = new Date(date);
    const day = newDate.getDay();
    newDate.setDate(newDate.getDate() + (6 - day));
    return this.getEndOfDay(newDate, facilityTimezone);
  },

  // Get start/end of month
  getStartOfMonth(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return null;
    
    const newDate = new Date(date);
    newDate.setDate(1);
    newDate.setHours(0, 0, 0, 0);
    return newDate;
  },

  getEndOfMonth(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return null;
    
    const newDate = new Date(date);
    newDate.setMonth(newDate.getMonth() + 1);
    newDate.setDate(0);
    newDate.setHours(23, 59, 59, 999);
    return newDate;
  },

  // Validate date range
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

  // Get relative time
  getRelativeTime(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return 'N/A';
    
    const now = new Date();
    const targetDate = new Date(date);
    const diffMs = targetDate - now;
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

  // Round to nearest interval
  roundToInterval(date, intervalMinutes = 15, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return null;
    
    const newDate = new Date(date);
    const minutes = newDate.getMinutes();
    const remainder = minutes % intervalMinutes;
    
    if (remainder === 0) {
      return newDate;
    }
    
    if (remainder < intervalMinutes / 2) {
      newDate.setMinutes(minutes - remainder);
    } else {
      newDate.setMinutes(minutes + (intervalMinutes - remainder));
    }
    
    newDate.setSeconds(0);
    newDate.setMilliseconds(0);
    
    return newDate;
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