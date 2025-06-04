// backend/src/utils/timezoneUtils.js (Simplified - Local Time Only)
class TimezoneUtils {
  
  // Default timezone for facilities
  static DEFAULT_TIMEZONE = 'America/Chicago';

  // Get current time as string for logging
  static getCurrentTimeString() {
    return new Date().toLocaleString();
  }

  // Format datetime for display with timezone label
  static formatForDisplay(dateTime, timezone = this.DEFAULT_TIMEZONE) {
    if (!dateTime) return null;
    
    try {
      const date = new Date(dateTime);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.warn('Display format failed:', error);
      return new Date(dateTime).toLocaleString('en-US');
    }
  }

  // Calculate duration between two dates in minutes
  static calculateDuration(startTime, endTime) {
    try {
      return Math.round((new Date(endTime) - new Date(startTime)) / (1000 * 60));
    } catch (error) {
      console.error('Duration calculation failed:', error);
      return 60; // Default to 1 hour
    }
  }

  // Get timezone abbreviation for display
  static getTimezoneAbbreviation(timezone = this.DEFAULT_TIMEZONE) {
    const abbreviations = {
      'America/New_York': 'ET',
      'America/Chicago': 'CT',
      'America/Denver': 'MT',
      'America/Phoenix': 'MST',
      'America/Los_Angeles': 'PT',
      'America/Anchorage': 'AKT',
      'Pacific/Honolulu': 'HST'
    };
    
    return abbreviations[timezone] || 'Local';
  }

  // Validate timezone string
  static isValidTimezone(timezone) {
    const validTimezones = [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Phoenix',
      'America/Los_Angeles',
      'America/Anchorage',
      'Pacific/Honolulu'
    ];
    
    return validTimezones.includes(timezone);
  }

  // Format time range for display
  static formatTimeRange(startTime, endTime) {
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
        hour12: true
      });
      
      const endStr = end.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      return `${startStr} - ${endStr}`;
    } catch (error) {
      console.error('Format time range failed:', error);
      return 'Invalid time range';
    }
  }

  // Get human-readable timezone display name
  static getTimezoneDisplayName(timezone = this.DEFAULT_TIMEZONE) {
    const displayNames = {
      'America/New_York': 'Eastern Time',
      'America/Chicago': 'Central Time',
      'America/Denver': 'Mountain Time',
      'America/Phoenix': 'Mountain Time (no DST)',
      'America/Los_Angeles': 'Pacific Time',
      'America/Anchorage': 'Alaska Time',
      'Pacific/Honolulu': 'Hawaii Time'
    };
    
    return displayNames[timezone] || timezone;
  }

  // Validate that a time is reasonable for ice time booking
  static validateIceTimeHours(dateTime) {
    try {
      const hour = new Date(dateTime).getHours();
      
      // Ice arenas typically operate between 5 AM and 11 PM
      const isReasonableHour = hour >= 5 && hour <= 23;
      
      return {
        isValid: isReasonableHour,
        warning: isReasonableHour ? null : 'This time is outside typical arena operating hours',
        hour
      };
    } catch (error) {
      console.error('Validate ice time hours failed:', error);
      return { isValid: true, warning: null };
    }
  }

  // Get list of supported timezones for US facilities
  static getSupportedTimezones() {
    return [
      { value: 'America/New_York', label: 'Eastern Time (ET)', abbr: 'ET' },
      { value: 'America/Chicago', label: 'Central Time (CT)', abbr: 'CT' },
      { value: 'America/Denver', label: 'Mountain Time (MT)', abbr: 'MT' },
      { value: 'America/Phoenix', label: 'Mountain Time - Arizona (MST)', abbr: 'MST' },
      { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', abbr: 'PT' },
      { value: 'America/Anchorage', label: 'Alaska Time (AKT)', abbr: 'AKT' },
      { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)', abbr: 'HST' }
    ];
  }

  // Parse datetime string - no conversion needed
  static parseDateTime(dateTimeString) {
    if (!dateTimeString) return null;
    
    try {
      const date = new Date(dateTimeString);
      return isNaN(date.getTime()) ? null : date;
    } catch (error) {
      console.error('Parse datetime failed:', error);
      return null;
    }
  }

  // Format date for API - return ISO string
  static formatForAPI(date) {
    if (!date) return null;
    
    try {
      const d = new Date(date);
      return isNaN(d.getTime()) ? null : d.toISOString();
    } catch (error) {
      console.error('Format for API failed:', error);
      return null;
    }
  }
}

module.exports = TimezoneUtils;