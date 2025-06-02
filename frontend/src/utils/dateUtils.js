// frontend/src/utils/dateUtils.js (Fixed with Proper Timezone Conversions)

export const dateUtils = {
  // Default facility timezone
  DEFAULT_TIMEZONE: 'America/Chicago',

  // Timezone offset mappings for US timezones (in minutes from UTC)
  // Negative values mean behind UTC (which is typical for US)
  TIMEZONE_OFFSETS: {
    'America/New_York': { standard: 300, dst: 240 },      // EST: UTC-5, EDT: UTC-4
    'America/Chicago': { standard: 360, dst: 300 },       // CST: UTC-6, CDT: UTC-5
    'America/Denver': { standard: 420, dst: 360 },        // MST: UTC-7, MDT: UTC-6
    'America/Phoenix': { standard: 420, dst: 420 },       // MST: UTC-7 (no DST)
    'America/Los_Angeles': { standard: 480, dst: 420 },   // PST: UTC-8, PDT: UTC-7
    'America/Anchorage': { standard: 540, dst: 480 },     // AKST: UTC-9, AKDT: UTC-8
    'Pacific/Honolulu': { standard: 600, dst: 600 }       // HST: UTC-10 (no DST)
  },

  // Check if a date is in DST (US rules)
  isDST(date) {
    const year = date.getFullYear();
    
    // Find second Sunday in March
    const march = new Date(year, 2, 1);
    const daysUntilSunday = (7 - march.getDay()) % 7;
    const secondSunday = 1 + daysUntilSunday + 7;
    const dstStart = new Date(year, 2, secondSunday, 2, 0, 0);
    
    // Find first Sunday in November
    const november = new Date(year, 10, 1);
    const daysUntilSundayNov = (7 - november.getDay()) % 7;
    const firstSundayNov = 1 + daysUntilSundayNov;
    const dstEnd = new Date(year, 10, firstSundayNov, 2, 0, 0);
    
    return date >= dstStart && date < dstEnd;
  },

  // Get timezone offset in minutes for a specific date
  getTimezoneOffset(timezone, date) {
    const offsets = this.TIMEZONE_OFFSETS[timezone];
    if (!offsets) {
      console.warn(`Unknown timezone: ${timezone}, using default`);
      return this.TIMEZONE_OFFSETS[this.DEFAULT_TIMEZONE].standard;
    }
    
    // Check if timezone observes DST
    if (offsets.standard === offsets.dst) {
      return offsets.standard;
    }
    
    // Check if date is in DST
    return this.isDST(date) ? offsets.dst : offsets.standard;
  },

  // Convert UTC to facility timezone
  convertUTCToFacilityTime(utcDate, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!utcDate) return null;
    
    const date = new Date(utcDate);
    if (isNaN(date.getTime())) return null;
    
    // Get timezone offset in minutes
    const offsetMinutes = this.getTimezoneOffset(facilityTimezone, date);
    
    // Create new date with offset applied
    // Subtract offset because US timezones are behind UTC
    return new Date(date.getTime() - (offsetMinutes * 60 * 1000));
  },

  // Convert facility timezone to UTC
  convertFacilityTimeToUTC(facilityDate, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!facilityDate) return null;
    
    const date = new Date(facilityDate);
    if (isNaN(date.getTime())) return null;
    
    // Get timezone offset in minutes
    const offsetMinutes = this.getTimezoneOffset(facilityTimezone, date);
    
    // Create new date with offset removed
    // Add offset to get back to UTC
    const utcDate = new Date(date.getTime() + (offsetMinutes * 60 * 1000));
    return utcDate.toISOString();
  },

  // Create a date in facility timezone from date and time inputs
  createFacilityDateTime(dateStr, timeStr, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!dateStr || !timeStr) return null;
    
    try {
      // Create datetime string
      const dateTimeStr = `${dateStr}T${timeStr}:00`;
      
      // Parse as local date
      const localDate = new Date(dateTimeStr);
      
      if (isNaN(localDate.getTime())) return null;
      
      // This represents the intended facility time
      // We need to convert it to UTC for storage
      return localDate;
    } catch (error) {
      console.error('Create facility datetime failed:', error);
      return null;
    }
  },

  // Format date for API calls (always UTC ISO string)
  formatForAPI(date) {
    if (!date) return null;
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    
    return d.toISOString();
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
      hour12: true
    };

    try {
      // If date is already a Date object in facility time, format directly
      if (date instanceof Date) {
        return date.toLocaleString('en-US', { ...defaultOptions, ...options });
      }
      
      // If it's a string, assume UTC and convert
      const utcDate = new Date(date);
      const facilityDate = this.convertUTCToFacilityTime(utcDate, facilityTimezone);
      return facilityDate.toLocaleString('en-US', { ...defaultOptions, ...options });
    } catch (error) {
      console.warn('Display format failed:', error);
      return 'Invalid Date';
    }
  },

  // Format time only
  formatTimeOnly(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return 'N/A';
    
    return this.formatForDisplay(date, facilityTimezone, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  },

  // Format date only
  formatDateOnly(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return 'N/A';
    
    return this.formatForDisplay(date, facilityTimezone, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },

  // Extract date string for input fields (YYYY-MM-DD)
  extractDateString(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return '';
    
    try {
      let dateObj;
      
      // If it's a string (UTC), convert to facility time first
      if (typeof date === 'string') {
        const utcDate = new Date(date);
        dateObj = this.convertUTCToFacilityTime(utcDate, facilityTimezone);
      } else {
        dateObj = new Date(date);
      }
      
      if (isNaN(dateObj.getTime())) return '';
      
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.warn('Extract date string failed:', error);
      return '';
    }
  },

  // Extract time string for input fields (HH:MM)
  extractTimeString(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return '';
    
    try {
      let dateObj;
      
      // If it's a string (UTC), convert to facility time first
      if (typeof date === 'string') {
        const utcDate = new Date(date);
        dateObj = this.convertUTCToFacilityTime(utcDate, facilityTimezone);
      } else {
        dateObj = new Date(date);
      }
      
      if (isNaN(dateObj.getTime())) return '';
      
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
    
    const now = new Date();
    const checkDate = new Date(date);
    
    return checkDate < now;
  },

  // Check if date is today
  isToday(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return false;
    
    const today = new Date();
    const checkDate = new Date(date);
    
    // Compare dates in facility timezone
    if (typeof date === 'string') {
      const facilityDate = this.convertUTCToFacilityTime(checkDate, facilityTimezone);
      const facilityToday = this.convertUTCToFacilityTime(today, facilityTimezone);
      return facilityDate.toDateString() === facilityToday.toDateString();
    }
    
    return today.toDateString() === checkDate.toDateString();
  },

  // Calculate duration between two dates in minutes
  getDuration(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    return Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60));
  },

  // Get start of day in facility timezone
  getStartOfDay(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return null;
    
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  // Get end of day in facility timezone
  getEndOfDay(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return null;
    
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  },

  // Get start of week in facility timezone
  getStartOfWeek(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return null;
    
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return this.getStartOfDay(d, facilityTimezone);
  },

  // Get end of week in facility timezone
  getEndOfWeek(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return null;
    
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (6 - day));
    return this.getEndOfDay(d, facilityTimezone);
  },

  // Get start of month in facility timezone
  getStartOfMonth(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return null;
    
    const d = new Date(date);
    d.setDate(1);
    return this.getStartOfDay(d, facilityTimezone);
  },

  // Get end of month in facility timezone
  getEndOfMonth(date, facilityTimezone = this.DEFAULT_TIMEZONE) {
    if (!date) return null;
    
    const d = new Date(date);
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return this.getEndOfDay(d, facilityTimezone);
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

  // Get timezone display name
  getTimezoneDisplayName(timezone) {
    const displayNames = {
      'America/New_York': 'ET',
      'America/Chicago': 'CT',
      'America/Denver': 'MT',
      'America/Phoenix': 'MST',
      'America/Los_Angeles': 'PT',
      'America/Anchorage': 'AKT',
      'Pacific/Honolulu': 'HST'
    };
    
    return displayNames[timezone] || timezone;
  },

  // Get common US timezones for facility configuration
  getCommonTimezones() {
    return [
      { value: 'America/New_York', label: 'Eastern Time (ET)' },
      { value: 'America/Chicago', label: 'Central Time (CT)' },
      { value: 'America/Denver', label: 'Mountain Time (MT)' },
      { value: 'America/Phoenix', label: 'Mountain Time - Arizona (MST)' },
      { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
      { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
      { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' }
    ];
  }
};