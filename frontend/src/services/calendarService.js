// frontend/src/services/calendarService.js (Enhanced with Timezone Support)
import api from './api';
import { dateUtils } from '../utils/dateUtils';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Helper function to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to determine if error is retryable
const isRetryableError = (error) => {
  if (!error.response) return true; // Network error
  const status = error.response.status;
  return status >= 500 || status === 429; // Server errors or rate limit
};

// Generic retry wrapper
const retryOperation = async (operation, retries = MAX_RETRIES) => {
  let lastError;
  
  for (let i = 0; i <= retries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry if it's not a retryable error or we're out of retries
      if (!isRetryableError(error) || i === retries) {
        throw error;
      }
      
      // Exponential backoff
      const delay = RETRY_DELAY * Math.pow(2, i);
      console.log(`Retrying operation after ${delay}ms (attempt ${i + 1}/${retries})`);
      await sleep(delay);
    }
  }
  
  throw lastError;
};

const calendarService = {
  // Get episodes for calendar view with timezone support
  async getEpisodes(params = {}, options = {}) {
    try {
      const operation = () => api.get('/api/episodes', { 
        params: {
          ...params,
          timezone: options.timezone // Pass client timezone preference
        },
        signal: options.signal // Support request cancellation
      });
      
      const response = await retryOperation(operation);
      return { 
        success: true, 
        data: {
          ...response.data,
          facilityTimezone: response.data.timezone // Server returns facility timezone
        }
      };
    } catch (error) {
      // Check if request was cancelled
      if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
        return { success: false, cancelled: true, error: 'Request cancelled' };
      }
      
      console.error('Get episodes error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch calendar events'
      };
    }
  },

  // Get calendar resources (facilities and rinks)
  async getCalendarResources(params = {}) {
    try {
      const operation = () => api.get('/api/episodes/resources', { params });
      const response = await retryOperation(operation);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Get calendar resources error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch calendar resources'
      };
    }
  },

  // Get single episode details with timezone support
  async getEpisodeById(id, timezone = null) {
    try {
      const operation = () => api.get(`/api/episodes/${id}`, { 
        params: { timezone } 
      });
      const response = await retryOperation(operation);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Get episode error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch episode details'
      };
    }
  },

  // Validate episode move/resize with timezone conversion
  async validateEpisodeMove(episodeId, newStartTime, newEndTime, facilityId, facilityTimezone = null) {
    try {
      // Convert times to facility timezone if needed
      let convertedStartTime = newStartTime;
      let convertedEndTime = newEndTime;
      
      if (facilityTimezone) {
        // If we have a specific facility timezone, ensure times are converted properly
        convertedStartTime = dateUtils.convertToUTC(new Date(newStartTime), facilityTimezone);
        convertedEndTime = dateUtils.convertToUTC(new Date(newEndTime), facilityTimezone);
      }

      const response = await api.post('/api/episodes/validate-move', {
        episode_id: episodeId,
        new_start_time: convertedStartTime,
        new_end_time: convertedEndTime,
        facility_id: facilityId
      });
      
      return { 
        success: true, 
        data: {
          isValid: response.data.valid,
          conflicts: response.data.conflicts || [],
          warnings: response.data.warnings || [],
          businessRuleViolations: response.data.businessRuleViolations || []
        }
      };
    } catch (error) {
      console.error('Validate episode move error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to validate move'
      };
    }
  },

  // Move episode with drag and drop and timezone support
  async moveEpisode(episodeId, newStartTime, newEndTime, facilityTimezone = null) {
    try {
      // Convert times if facility timezone is provided
      let convertedStartTime = newStartTime;
      let convertedEndTime = newEndTime;
      
      if (facilityTimezone) {
        convertedStartTime = dateUtils.convertToUTC(new Date(newStartTime), facilityTimezone);
        convertedEndTime = dateUtils.convertToUTC(new Date(newEndTime), facilityTimezone);
      }

      // Calculate new duration
      const duration = Math.round((new Date(convertedEndTime) - new Date(convertedStartTime)) / (1000 * 60));

      const response = await api.put(`/api/episodes/${episodeId}/move`, {
        new_start_time: convertedStartTime,
        new_end_time: convertedEndTime,
        new_duration: duration
      });
      
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Move episode error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to move episode'
      };
    }
  },

  // Resize episode with timezone support
  async resizeEpisode(episodeId, newEndTime, facilityTimezone = null) {
    try {
      // Convert end time if facility timezone is provided
      let convertedEndTime = newEndTime;
      
      if (facilityTimezone) {
        convertedEndTime = dateUtils.convertToUTC(new Date(newEndTime), facilityTimezone);
      }

      const response = await api.put(`/api/episodes/${episodeId}/resize`, {
        new_end_time: convertedEndTime
      });
      
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Resize episode error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to resize episode'
      };
    }
  },

  // Batch validate multiple moves
  async validateBatchMoves(moves, facilityTimezone = null) {
    try {
      // Convert times for all moves if facility timezone is provided
      const convertedMoves = moves.map(move => {
        if (facilityTimezone) {
          return {
            ...move,
            newStartTime: dateUtils.convertToUTC(new Date(move.newStartTime), facilityTimezone),
            newEndTime: dateUtils.convertToUTC(new Date(move.newEndTime), facilityTimezone)
          };
        }
        return move;
      });

      const response = await api.post('/api/episodes/validate-batch-moves', {
        moves: convertedMoves.map(move => ({
          episode_id: move.episodeId,
          new_start_time: move.newStartTime,
          new_end_time: move.newEndTime,
          resource_id: move.resourceId,
          facility_id: move.facilityId
        }))
      });

      return { 
        success: true, 
        data: {
          isValid: response.data.valid,
          results: response.data.results || [],
          overallConflicts: response.data.overallConflicts || []
        }
      };
    } catch (error) {
      console.error('Batch validation error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to validate batch moves'
      };
    }
  },

  // Create new episode (Admin only) with timezone support
  async createEpisode(episodeData, facilityTimezone = null) {
    try {
      // Validate required fields
      if (!episodeData.event_id || !episodeData.episode_start_date_time || !episodeData.episode_end_date_time) {
        return { 
          success: false, 
          error: 'Missing required fields' 
        };
      }
      
      // Convert times if facility timezone is provided
      let convertedData = { ...episodeData };
      
      if (facilityTimezone) {
        convertedData.episode_start_date_time = dateUtils.convertToUTC(
          new Date(episodeData.episode_start_date_time), 
          facilityTimezone
        );
        convertedData.episode_end_date_time = dateUtils.convertToUTC(
          new Date(episodeData.episode_end_date_time), 
          facilityTimezone
        );
        convertedData.facility_timezone = facilityTimezone;
      }
      
      const response = await api.post('/api/episodes', convertedData);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Create episode error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to create episode'
      };
    }
  },

  // Update episode (Admin only) with timezone support
  async updateEpisode(id, episodeData, facilityTimezone = null) {
    try {
      // Convert datetime fields if facility timezone is provided
      let convertedData = { ...episodeData };
      
      if (facilityTimezone) {
        if (episodeData.episode_start_date_time) {
          convertedData.episode_start_date_time = dateUtils.convertToUTC(
            new Date(episodeData.episode_start_date_time), 
            facilityTimezone
          );
        }
        if (episodeData.episode_end_date_time) {
          convertedData.episode_end_date_time = dateUtils.convertToUTC(
            new Date(episodeData.episode_end_date_time), 
            facilityTimezone
          );
        }
      }
      
      // Clean up the data before sending
      const cleanData = {
        episode_title: convertedData.episode_title?.trim(),
        episode_description: convertedData.episode_description?.trim(),
        episode_price: convertedData.episode_price,
        episode_status: convertedData.episode_status,
        episode_start_date_time: convertedData.episode_start_date_time,
        episode_end_date_time: convertedData.episode_end_date_time
      };
      
      const response = await api.put(`/api/episodes/${id}`, cleanData);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Update episode error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to update episode'
      };
    }
  },

  // Delete episode (Admin only)
  async deleteEpisode(id) {
    try {
      const response = await api.delete(`/api/episodes/${id}`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Delete episode error:', error);
      
      // Check for specific error cases
      if (error.response?.status === 400) {
        return {
          success: false,
          error: 'Cannot delete episode with existing bookings'
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to delete episode'
      };
    }
  },

  // Create new event with episodes (Admin only) with timezone support
  async createEvent(eventData, facilityTimezone = null) {
    try {
      // Validate required fields
      if (!eventData.resource_id || !eventData.event_start_date_time || !eventData.event_end_date_time) {
        return { 
          success: false, 
          error: 'Missing required fields' 
        };
      }
      
      // Convert times if facility timezone is provided
      let convertedData = { ...eventData };
      
      if (facilityTimezone) {
        convertedData.event_start_date_time = dateUtils.createFacilityDateTime(
          eventData.event_date || eventData.event_start_date_time.split('T')[0],
          eventData.start_time || eventData.event_start_date_time.split('T')[1].slice(0, 5),
          facilityTimezone
        );
        convertedData.event_end_date_time = dateUtils.createFacilityDateTime(
          eventData.event_date || eventData.event_end_date_time.split('T')[0],
          eventData.end_time || eventData.event_end_date_time.split('T')[1].slice(0, 5),
          facilityTimezone
        );
        
        if (eventData.repeat_end_date) {
          convertedData.repeat_end_date = eventData.repeat_end_date;
        }
      }
      
      // Validate dates
      const startDate = new Date(convertedData.event_start_date_time);
      const endDate = new Date(convertedData.event_end_date_time);
      
      if (startDate >= endDate) {
        return { 
          success: false, 
          error: 'End time must be after start time' 
        };
      }
      
      if (convertedData.repeat_mode !== 'once' && convertedData.repeat_end_date) {
        const repeatEnd = new Date(convertedData.repeat_end_date);
        if (repeatEnd <= startDate) {
          return { 
            success: false, 
            error: 'Repeat end date must be after the start date' 
          };
        }
      }
      
      const response = await api.post('/api/events', convertedData);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Create event error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to create event'
      };
    }
  },

  // Get events by resource
  async getEventsByResource(resourceId, params = {}) {
    try {
      const operation = () => api.get(`/api/events/resource/${resourceId}`, { params });
      const response = await retryOperation(operation);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Get events by resource error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch events'
      };
    }
  },

  // Delete event (Admin only)
  async deleteEvent(id) {
    try {
      const response = await api.delete(`/api/events/${id}`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Delete event error:', error);
      
      // Check for specific error cases
      if (error.response?.status === 400) {
        return {
          success: false,
          error: 'Cannot delete event with episodes that have bookings'
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to delete event'
      };
    }
  },

  // Helper function to format date for API
  formatDateForAPI(date) {
    if (!date) return null;
    return dateUtils.formatForAPI(date);
  },

  // Helper function to get calendar date range with timezone support
  getCalendarDateRange(view, date, facilityTimezone = dateUtils.DEFAULT_TIMEZONE) {
    const start = dateUtils.convertToFacilityTime(new Date(date), facilityTimezone);
    const end = dateUtils.convertToFacilityTime(new Date(date), facilityTimezone);

    switch (view) {
      case 'month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week':
        const day = start.getDay();
        start.setDate(start.getDate() - day);
        start.setHours(0, 0, 0, 0);
        end.setDate(end.getDate() + (6 - day));
        end.setHours(23, 59, 59, 999);
        break;
      case 'day':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      default:
        break;
    }

    return {
      start: dateUtils.convertToUTC(start, facilityTimezone).toISOString(),
      end: dateUtils.convertToUTC(end, facilityTimezone).toISOString()
    };
  },

  // Get status color mapping
  getStatusColorMap() {
    return {
      'available': '#FFFFFF',      // White: Unassigned
      'assigned': '#FFEB3B',       // Yellow: Assigned Pending
      'pending': '#FFEB3B',        // Yellow: Assigned Pending
      'booked': '#4CAF50',         // Green: Booked/Paid
      'maintenance': '#9E9E9E',    // Gray: Unavailable/Maintenance
      'cancelled': '#9E9E9E'       // Gray: Unavailable
    };
  },

  // Get admin-specific status color (for assigned reserved)
  getAdminStatusColor(episode) {
    if (episode.status === 'assigned' && episode.extendedProps?.assignedProgram) {
      return '#2196F3'; // Blue: Assigned Reserved
    }
    return this.getStatusColorMap()[episode.status] || '#FFFFFF';
  },

  // Check if episode can be moved/resized
  canEditEpisode(episode) {
    if (!episode) return { allowed: false, reason: 'Episode not found' };
    
    const status = episode.extendedProps?.status || episode.status;
    const facilityTimezone = episode.extendedProps?.facilityTimezone || dateUtils.DEFAULT_TIMEZONE;
    const startTime = new Date(episode.start);
    
    // Cannot edit past events (check in facility timezone)
    if (dateUtils.isPast(startTime, facilityTimezone)) {
      return { allowed: false, reason: 'Cannot modify past ice time' };
    }
    
    // Cannot edit booked events
    if (status === 'booked') {
      return { allowed: false, reason: 'Cannot modify booked ice time' };
    }
    
    // Cannot edit if it has active bookings
    if (episode.extendedProps?.hasBookings) {
      return { allowed: false, reason: 'Cannot modify ice time with active bookings' };
    }

    // Check for maintenance status
    if (status === 'maintenance') {
      return { allowed: false, reason: 'Cannot modify maintenance periods' };
    }
    
    return { allowed: true };
  },

  // Validate episode data before submission with timezone support
  validateEpisodeData(data, facilityTimezone = dateUtils.DEFAULT_TIMEZONE) {
    const errors = {};
    
    if (!data.episode_title?.trim()) {
      errors.episode_title = 'Title is required';
    }
    
    if (data.episode_price !== undefined && data.episode_price !== null && data.episode_price < 0) {
      errors.episode_price = 'Price cannot be negative';
    }
    
    if (data.episode_start_date_time && data.episode_end_date_time) {
      const validation = dateUtils.validateDateRange(
        data.episode_start_date_time, 
        data.episode_end_date_time, 
        facilityTimezone
      );
      
      if (!validation.isValid) {
        errors.date = validation.errors.join(', ');
      }
    }
    
    return errors;
  },

  // Check if episode can be deleted
  canDeleteEpisode(episode) {
    if (!episode) return false;
    
    // Cannot delete if there are bookings
    if (episode.bookings && episode.bookings.length > 0) {
      return false;
    }
    
    // Cannot delete if status is booked
    if (episode.episode_status === 'booked') {
      return false;
    }
    
    return true;
  },

  // Smart snap to grid helper with timezone support
  snapToGrid(dateTime, snapDuration = 15, facilityTimezone = dateUtils.DEFAULT_TIMEZONE) {
    return dateUtils.roundToInterval(dateTime, snapDuration, facilityTimezone);
  },

  // Check if time is within business hours
  isWithinBusinessHours(startTime, endTime, facilitySchedule, facilityTimezone = dateUtils.DEFAULT_TIMEZONE) {
    if (!facilitySchedule) return true;
    
    const facilityStartTime = dateUtils.convertToFacilityTime(startTime, facilityTimezone);
    const facilityEndTime = dateUtils.convertToFacilityTime(endTime, facilityTimezone);
    
    const dayOfWeek = facilityStartTime.getDay();
    const daySchedule = facilitySchedule[dayOfWeek];
    
    if (!daySchedule || daySchedule.isClosed) return false;
    
    const startHour = facilityStartTime.getHours() + facilityStartTime.getMinutes() / 60;
    const endHour = facilityEndTime.getHours() + facilityEndTime.getMinutes() / 60;
    
    return startHour >= daySchedule.openHour && endHour <= daySchedule.closeHour;
  },

  // Get conflict types for display
  getConflictTypes() {
    return {
      OVERLAP: 'overlap',
      BUSINESS_HOURS: 'business_hours',
      FACILITY_CLOSED: 'facility_closed',
      RESOURCE_UNAVAILABLE: 'resource_unavailable',
      DURATION_INVALID: 'duration_invalid',
      PAST_DATE: 'past_date',
      TIMEZONE_BOUNDARY: 'timezone_boundary'
    };
  },

  // Format conflict message with timezone awareness
  formatConflictMessage(conflict, facilityTimezone = dateUtils.DEFAULT_TIMEZONE) {
    const messages = {
      overlap: 'Time slot overlaps with existing ice time',
      business_hours: 'Time is outside facility business hours',
      facility_closed: 'Facility is closed at this time',
      resource_unavailable: 'Resource is not available',
      duration_invalid: 'Duration is too short or too long',
      past_date: 'Cannot schedule in the past',
      timezone_boundary: 'Time change crosses timezone boundary'
    };
    
    let message = messages[conflict.type] || conflict.message || 'Schedule conflict detected';
    
    // Add timezone context if available
    if (conflict.time && facilityTimezone) {
      const timezoneDisplay = dateUtils.getTimezoneDisplayName(facilityTimezone);
      message += ` (${timezoneDisplay})`;
    }
    
    return message;
  },

  // Convert calendar event times for display in specific timezone
  convertEventTimesForDisplay(event, targetTimezone) {
    if (!event || !targetTimezone) return event;
    
    return {
      ...event,
      start: dateUtils.convertToFacilityTime(event.start, targetTimezone),
      end: dateUtils.convertToFacilityTime(event.end, targetTimezone),
      extendedProps: {
        ...event.extendedProps,
        displayStartTime: dateUtils.formatTimeOnly(event.start, targetTimezone),
        displayEndTime: dateUtils.formatTimeOnly(event.end, targetTimezone),
        displayDate: dateUtils.formatDateOnly(event.start, targetTimezone),
        displayTimezone: targetTimezone
      }
    };
  },

  // Get timezone information for a facility
  async getFacilityTimezone(facilityId) {
    try {
      const response = await api.get(`/api/facilities/${facilityId}`);
      return response.data.facility?.facility_time_zone || dateUtils.DEFAULT_TIMEZONE;
    } catch (error) {
      console.error('Get facility timezone error:', error);
      return dateUtils.DEFAULT_TIMEZONE;
    }
  }
};

export default calendarService;