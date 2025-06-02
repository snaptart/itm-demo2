// frontend/src/services/calendarService.js (FIXED - Trust Backend Times)
import api from './api';
import { dateUtils } from '../utils/dateUtils';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Cache for facility timezones
const facilityTimezoneCache = new Map();

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
  // Get episodes for calendar view - FIXED to trust backend times
  async getEpisodes(params = {}, options = {}) {
    try {
      // Get facility timezone if facility_id is provided
      let facilityTimezone = options.timezone;
      if (!facilityTimezone && params.facility_id) {
        facilityTimezone = await this.getFacilityTimezone(params.facility_id);
      }

      const operation = () => api.get('/api/episodes', { 
        params: {
          ...params,
          timezone: facilityTimezone
        },
        signal: options.signal
      });
      
      const response = await retryOperation(operation);
      
      // FIXED: Trust the backend to provide correctly formatted times
      // The backend now returns times already converted to facility timezone
      const processedEvents = response.data.events?.map(event => {
        // Add debug logging to verify times
        if (event.extendedProps?.debug) {
          console.log(`Event ${event.id} times:`, {
            display: event.start,
            utc: event.extendedProps.debug.utcStart,
            timezone: event.extendedProps.facilityTimezone
          });
        }
        
        // Return the event as-is, trusting backend conversion
        return {
          ...event,
          // Ensure FullCalendar gets Date objects
          start: new Date(event.start),
          end: new Date(event.end)
        };
      }) || [];

      return { 
        success: true, 
        data: {
          ...response.data,
          events: processedEvents,
          facilityTimezone: response.data.timezone || facilityTimezone
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
      
      return { 
        success: true, 
        data: response.data
      };
    } catch (error) {
      console.error('Get calendar resources error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch calendar resources'
      };
    }
  },

  // Get single episode details - FIXED to trust backend times
  async getEpisodeById(id, timezone = null) {
    try {
      const operation = () => api.get(`/api/episodes/${id}`, { 
        params: { timezone }
      });
      const response = await retryOperation(operation);

      // Debug logging
      if (response.data.episode?.debug) {
        console.log(`Episode ${id} times from backend:`, response.data.episode.debug);
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('Get episode error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch episode details'
      };
    }
  },

  // Create new event - Send facility times to backend
  async createEvent(eventData, facilityTimezone = null) {
    try {
      console.log('Calendar Service - Creating event with data:', eventData);
      
      // Validate required fields
      if (!eventData.resource_id || !eventData.event_start_date_time || !eventData.event_end_date_time) {
        return { 
          success: false, 
          error: 'Missing required fields' 
        };
      }
      
      // The datetime strings should already be in facility timezone from the form
      const convertedData = {
        ...eventData,
        facility_timezone: facilityTimezone || dateUtils.DEFAULT_TIMEZONE
      };
      
      console.log('Calendar Service - Sending to API:', convertedData);
      
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

  // Move episode - Send facility times to backend
  async moveEpisode(episodeId, newStartTime, newEndTime, facilityTimezone = null) {
    try {
      // The times coming from the calendar are already in facility timezone
      const response = await api.put(`/api/episodes/${episodeId}/move`, {
        new_start_time: newStartTime,
        new_end_time: newEndTime
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

  // Resize episode - Send facility times to backend
  async resizeEpisode(episodeId, newEndTime, facilityTimezone = null) {
    try {
      const response = await api.put(`/api/episodes/${episodeId}/resize`, {
        new_end_time: newEndTime
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

  // Validate episode move/resize
  async validateEpisodeMove(episodeId, newStartTime, newEndTime, facilityId, facilityTimezone = null) {
    try {
      const response = await api.post('/api/episodes/validate-move', {
        episode_id: episodeId,
        new_start_time: newStartTime,
        new_end_time: newEndTime,
        facility_id: facilityId
      });
      
      return { 
        success: true, 
        data: {
          isValid: response.data.valid,
          conflicts: response.data.conflicts || [],
          warnings: response.data.warnings || [],
          businessRuleViolations: response.data.businessRuleViolations || [],
          facilityTimezone
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

  // Update episode (Admin only)
  async updateEpisode(id, episodeData, facilityTimezone = null) {
    try {
      // Clean up the data before sending
      const cleanData = {
        episode_title: episodeData.episode_title?.trim(),
        episode_description: episodeData.episode_description?.trim(),
        episode_price: episodeData.episode_price,
        episode_status: episodeData.episode_status
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

  // Helper function to get calendar date range
  getCalendarDateRange(view, date, facilityTimezone = dateUtils.DEFAULT_TIMEZONE) {
    const start = new Date(date);
    const end = new Date(date);

    switch (view) {
      case 'month':
        const startOfMonth = dateUtils.getStartOfMonth(start, facilityTimezone);
        const endOfMonth = dateUtils.getEndOfMonth(start, facilityTimezone);
        return {
          start: dateUtils.formatForAPI(startOfMonth),
          end: dateUtils.formatForAPI(endOfMonth)
        };
      case 'week':
        const startOfWeek = dateUtils.getStartOfWeek(start, facilityTimezone);
        const endOfWeek = dateUtils.getEndOfWeek(start, facilityTimezone);
        return {
          start: dateUtils.formatForAPI(startOfWeek),
          end: dateUtils.formatForAPI(endOfWeek)
        };
      case 'day':
        const startOfDay = dateUtils.getStartOfDay(start, facilityTimezone);
        const endOfDay = dateUtils.getEndOfDay(start, facilityTimezone);
        return {
          start: dateUtils.formatForAPI(startOfDay),
          end: dateUtils.formatForAPI(endOfDay)
        };
      default:
        return {
          start: dateUtils.formatForAPI(start),
          end: dateUtils.formatForAPI(end)
        };
    }
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
    const startTime = new Date(episode.start);
    
    // Cannot edit past events
    if (startTime < new Date()) {
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

  // Get timezone information for a facility with caching
  async getFacilityTimezone(facilityId) {
    try {
      // Check cache first
      if (facilityTimezoneCache.has(facilityId)) {
        return facilityTimezoneCache.get(facilityId);
      }

      const response = await api.get(`/api/facilities/${facilityId}`);
      const timezone = response.data.facility?.facility_time_zone || dateUtils.DEFAULT_TIMEZONE;
      
      // Cache the result
      facilityTimezoneCache.set(facilityId, timezone);
      
      return timezone;
    } catch (error) {
      console.error('Get facility timezone error:', error);
      return dateUtils.DEFAULT_TIMEZONE;
    }
  },

  // Clear facility timezone cache
  clearTimezoneCache() {
    facilityTimezoneCache.clear();
  }
};

export default calendarService;