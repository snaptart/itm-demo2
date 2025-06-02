// frontend/src/utils/dateUtils.js (Simplified - Local Time Only)

export const dateUtils = {
  // Default facility timezone for display purposes only
  DEFAULT_TIMEZONE: 'America/Chicago',

  // Format date for display with optional timezone label
  formatForDisplay(date, timezone = this.DEFAULT_TIMEZONE, options = {}) {
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
      const d = new Date(date);
      if (isNaN(d.getTime())) return 'Invalid Date';
      
      return d.toLocaleString('en-US', { ...defaultOptions, ...options });
    } catch (error) {
      console.warn('Display format failed:', error);
      return 'Invalid Date';
    }
  },

  // Format time only
  formatTimeOnly(date) {
    if (!date) return 'N/A';
    
    return this.formatForDisplay(date, null, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  },

  // Format date only
  formatDateOnly(date) {
    if (!date) return 'N/A';
    
    return this.formatForDisplay(date, null, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },

  // Extract date string for input fields (YYYY-MM-DD)
  extractDateString(date) {
    if (!date) return '';
    
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return '';
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.warn('Extract date string failed:', error);
      return '';
    }
  },

  // Extract time string for input fields (HH:MM)
  extractTimeString(date) {
    if (!date) return '';
    
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return '';
      
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch (error) {
      console.warn('Extract time string failed:', error);
      return '';
    }
  },

  // Create a date from date and time inputs
  createDateTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    
    try {
      // Create datetime string
      const dateTimeStr = `${dateStr}T${timeStr}:00`;
      const date = new Date(dateTimeStr);
      
      return isNaN(date.getTime()) ? null : date;
    } catch (error) {
      console.error('Create datetime failed:', error);
      return null;
    }
  },

  // Format date for API calls
	formatForAPI(date) {
	  if (!date) return null;
	  const d = new Date(date);
	  if (isNaN(d.getTime())) return null;
	  
	  // Format as YYYY-MM-DD HH:MM:SS (local time, no timezone)
	  const year = d.getFullYear();
	  const month = String(d.getMonth() + 1).padStart(2, '0');
	  const day = String(d.getDate()).padStart(2, '0');
	  const hours = String(d.getHours()).padStart(2, '0');
	  const minutes = String(d.getMinutes()).padStart(2, '0');
	  const seconds = String(d.getSeconds()).padStart(2, '0');
	  
	  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
	},

  // Check if date is in the past
  isPast(date) {
    if (!date) return false;
    return new Date(date) < new Date();
  },

  // Check if date is today
  isToday(date) {
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

  // Get start of day
  getStartOfDay(date) {
    if (!date) return null;
    
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  // Get end of day
  getEndOfDay(date) {
    if (!date) return null;
    
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  },

  // Get start of week
  getStartOfWeek(date) {
    if (!date) return null;
    
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return this.getStartOfDay(d);
  },

  // Get end of week
  getEndOfWeek(date) {
    if (!date) return null;
    
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (6 - day));
    return this.getEndOfDay(d);
  },

  // Get start of month
  getStartOfMonth(date) {
    if (!date) return null;
    
    const d = new Date(date);
    d.setDate(1);
    return this.getStartOfDay(d);
  },

  // Get end of month
  getEndOfMonth(date) {
    if (!date) return null;
    
    const d = new Date(date);
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return this.getEndOfDay(d);
  },

  // Validate date range
  validateDateRange(startDate, endDate) {
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
    
    if (this.isPast(start)) {
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

  // Get timezone display name (for display only)
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