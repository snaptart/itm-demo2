// frontend/src/utils/dateUtils.js

export const dateUtils = {
  // Format date for API calls
  formatForAPI(date) {
    if (!date) return null;
    return date.toISOString();
  },

  // Parse API date string
  parseFromAPI(dateString) {
    if (!dateString) return null;
    return new Date(dateString);
  },

  // Format date for display
  formatForDisplay(date, options = {}) {
    if (!date) return 'N/A';
    
    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };

    return new Date(date).toLocaleString('en-US', { ...defaultOptions, ...options });
  },

  // Format time only
  formatTimeOnly(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  },

  // Format date only
  formatDateOnly(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },

  // Check if date is in the past
  isPast(date) {
    return new Date(date) < new Date();
  },

  // Check if date is today
  isToday(date) {
    const today = new Date();
    const checkDate = new Date(date);
    return checkDate.toDateString() === today.toDateString();
  },

  // Check if date is this week
  isThisWeek(date) {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    const checkDate = new Date(date);
    return checkDate >= startOfWeek && checkDate <= endOfWeek;
  },

  // Add duration to date
  addDuration(date, minutes) {
    const newDate = new Date(date);
    newDate.setMinutes(newDate.getMinutes() + minutes);
    return newDate;
  },

  // Calculate duration between two dates in minutes
  getDuration(startDate, endDate) {
    return Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60));
  },

  // Round to nearest interval
  roundToInterval(date, intervalMinutes = 15) {
    const roundedDate = new Date(date);
    const minutes = roundedDate.getMinutes();
    const remainder = minutes % intervalMinutes;
    
    if (remainder === 0) return roundedDate;
    
    if (remainder < intervalMinutes / 2) {
      roundedDate.setMinutes(minutes - remainder);
    } else {
      roundedDate.setMinutes(minutes + (intervalMinutes - remainder));
    }
    
    roundedDate.setSeconds(0);
    roundedDate.setMilliseconds(0);
    
    return roundedDate;
  },

  // Get start of day
  getStartOfDay(date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    return startOfDay;
  },

  // Get end of day
  getEndOfDay(date) {
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay;
  },

  // Get start of week (Sunday)
  getStartOfWeek(date) {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);
    return this.getStartOfDay(startOfWeek);
  },

  // Get end of week (Saturday)
  getEndOfWeek(date) {
    const endOfWeek = new Date(date);
    const day = endOfWeek.getDay();
    endOfWeek.setDate(endOfWeek.getDate() + (6 - day));
    return this.getEndOfDay(endOfWeek);
  },

  // Get start of month
  getStartOfMonth(date) {
    const startOfMonth = new Date(date);
    startOfMonth.setDate(1);
    return this.getStartOfDay(startOfMonth);
  },

  // Get end of month
  getEndOfMonth(date) {
    const endOfMonth = new Date(date);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    return this.getEndOfDay(endOfMonth);
  },

  // Check if two date ranges overlap
  doRangesOverlap(start1, end1, start2, end2) {
    const s1 = new Date(start1);
    const e1 = new Date(end1);
    const s2 = new Date(start2);
    const e2 = new Date(end2);
    
    return s1 < e2 && s2 < e1;
  },

  // Get business day (skip weekends)
  getNextBusinessDay(date, skipWeekends = true) {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    
    if (skipWeekends) {
      while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
        nextDay.setDate(nextDay.getDate() + 1);
      }
    }
    
    return nextDay;
  },

  // Convert to timezone
  convertToTimezone(date, timezone = 'America/Chicago') {
    try {
      return new Date(date).toLocaleString('en-US', { timeZone: timezone });
    } catch (error) {
      console.warn('Timezone conversion failed:', error);
      return date;
    }
  },

  // Validate date range
  validateDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const errors = [];
    
    if (isNaN(start.getTime())) {
      errors.push('Invalid start date');
    }
    
    if (isNaN(end.getTime())) {
      errors.push('Invalid end date');
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

  // Format duration
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

  // Get relative time (e.g., "2 hours ago", "in 30 minutes")
  getRelativeTime(date) {
    const now = new Date();
    const diffMs = new Date(date) - now;
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

  // Create date range array
  createDateRange(startDate, endDate, intervalDays = 1) {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + intervalDays);
    }
    
    return dates;
  },

  // Check if date is within business hours
  isWithinBusinessHours(date, businessHours) {
    if (!businessHours) return true;
    
    const dayOfWeek = new Date(date).getDay();
    const dayHours = businessHours[dayOfWeek];
    
    if (!dayHours || dayHours.isClosed) return false;
    
    const hour = new Date(date).getHours();
    const minute = new Date(date).getMinutes();
    const timeInMinutes = hour * 60 + minute;
    
    const openTime = this.parseTimeString(dayHours.open);
    const closeTime = this.parseTimeString(dayHours.close);
    
    return timeInMinutes >= openTime && timeInMinutes <= closeTime;
  },

  // Parse time string (e.g., "09:00") to minutes since midnight
  parseTimeString(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  },

  // Format time string from minutes since midnight
  formatTimeFromMinutes(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
};