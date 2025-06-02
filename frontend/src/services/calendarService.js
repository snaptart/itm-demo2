// frontend/src/services/calendarService.js (Fixed UTC Handling)
import api from './api';
import { dateUtils } from '../utils/dateUtils';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Cache for facility timezones
const facilityTimezoneCache = new Map();

// Helper function to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to determine if error is retryable
const isRetryableError = (error) => {
  if (!error.response) return true; // Network error
  const status = error.response.status;
  return status >= 500 || status === 429;
};

// Generic retry wrapper
const retryOperation = async (operation, retries = MAX_RETRIES) => {
  let lastError;
  
  for (let i = 0; i <= retries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (!isRetryableError(error) || i === retries) {
        throw error;
      }
      
      const delay = RETRY_DELAY * Math.pow(2, i);
      console.log(`Retrying operation after ${delay}ms (attempt ${i + 1}/${retries})`);
      await sleep(delay);
    }
  }
  
  throw lastError;
};

const calendarService = {
  // Get episodes for calendar view - properly handle UTC from backend
  async getEpisodes(params = {}, options = {}) {
    try {
      // Get facility timezone if not provided
      let facilityTimezone = options.timezone;
      if (!facilityTimezone && params.facility_id) {
        facilityTimezone = await this.getFacilityTimezone(params.facility_id);
      }

      const operation = () => api.get('/api/episodes', { 
        params,
        signal: options.signal
      });
      
      const response = await retryOperation(operation);
      
      // Process events - backend returns UTC, we convert for display
      const processedEvents = response.data.events?.map(event => {
        // Parse UTC times from backend
        const utcStart = new Date(event.start);
        const utcEnd = new Date(event.end);
        
        // Get facility timezone from event metadata
        const eventTimezone = event.extendedProps?.facilityTimezone || facilityTimezone || dateUtils.DEFAULT_TIMEZONE;
        
        // Convert UTC to facility timezone for display
        const displayStart = dateUtils.convertUTCToFacilityTime(utcStart, eventTimezone);
        const displayEnd = dateUtils.convertUTCToFacilityTime(utcEnd, eventTimezone);
        
        return {
          ...event,
          // FullCalendar will display these in local browser time
          // but they represent facility time
          start: displayStart,
          end: displayEnd,
          // Keep UTC times in extended props for reference
          extendedProps: {
            ...event.extendedProps,
            utcStart: utcStart.toISOString(),
            utcEnd: utcEnd.toISOString()
          }
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

  // Get calendar resources
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

  // Get single episode details
  async getEpisodeById(id, timezone = null) {
    try {
      const operation = () => api.get(`/api/episodes/${id}`);
      const response = await retryOperation(operation);

      // The backend returns UTC times, we'll convert in the component if needed
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Get episode error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch episode details'
      };
    }
  },

  // Create new event - convert facility time to UTC before sending
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
      
      // The event times should already be in UTC from the create modal
      const response = await api.post('/api/events', eventData);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Create event error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to create event'
      };
    }
  },

  // Move episode - send UTC times to backend
  async moveEpisode(episodeId, newStartTime, newEndTime, facilityTimezone = null) {
    try {
      // Convert display times to UTC before sending to backend
      let utcStartTime, utcEndTime;
      
      if (facilityTimezone) {
        // Convert from facility time to UTC
        const displayStart = new Date(newStartTime);
        const displayEnd = new Date(newEndTime);
        
        utcStartTime = dateUtils.convertFacilityTimeToUTC(displayStart, facilityTimezone);
        utcEndTime = dateUtils.convertFacilityTimeToUTC(displayEnd, facilityTimezone);
      } else {
        // Assume already UTC
        utcStartTime = new Date(newStartTime).toISOString();
        utcEndTime = new Date(newEndTime).toISOString();
      }
      
      const response = await api.put(`/api/episodes/${episodeId}/move`, {
        new_start_time: utcStartTime,
        new_end_time: utcEndTime
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

  // Resize episode - send UTC times to backend
  async resizeEpisode(episodeId, newEndTime, facilityTimezone = null) {
    try {
      // Convert display time to UTC before sending to backend
      let utcEndTime;
      
      if (facilityTimezone) {
        const displayEnd = new Date(newEndTime);
        utcEndTime = dateUtils.convertFacilityTimeToUTC(displayEnd, facilityTimezone);
      } else {
        utcEndTime = new Date(newEndTime).toISOString();
      }
      
      const response = await api.put(`/api/episodes/${episodeId}/resize`, {
        new_end_time: utcEndTime
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
      // Convert to UTC if needed
      let utcStartTime, utcEndTime;
      
      if (facilityTimezone) {
        const displayStart = new Date(newStartTime);
        const displayEnd = new Date(newEndTime);
        
        utcStartTime = dateUtils.convertFacilityTimeToUTC(displayStart, facilityTimezone);
        utcEndTime = dateUtils.convertFacilityTimeToUTC(displayEnd, facilityTimezone);
      } else {
        utcStartTime = new Date(newStartTime).toISOString();
        utcEndTime = new Date(newEndTime).toISOString();
      }
      
      const response = await api.post('/api/episodes/validate-move', {
        episode_id: episodeId,
        new_start_time: utcStartTime,
        new_end_time: utcEndTime,
        facility_id: facilityId
      });
      
      return { 
        success: true, 
        data: {
          isValid: response.data.valid,
          conflicts: response.data.conflicts || [],
          warnings: response.data.warnings || []
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

  // Update episode
  async updateEpisode(id, episodeData) {
    try {
      const response = await api.put(`/api/episodes/${id}`, episodeData);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Update episode error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to update episode'
      };
    }
  },

  // Delete episode
  async deleteEpisode(id) {
    try {
      const response = await api.delete(`/api/episodes/${id}`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Delete episode error:', error);
      
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

  // Delete event
  async deleteEvent(id) {
    try {
      const response = await api.delete(`/api/events/${id}`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Delete event error:', error);
      
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

  // Helper function to get calendar date range in UTC
  getCalendarDateRange(view, date, facilityTimezone = dateUtils.DEFAULT_TIMEZONE) {
    // Get start and end of view period in facility timezone
    let facilityStart, facilityEnd;
    
    switch (view) {
      case 'month':
        facilityStart = dateUtils.getStartOfMonth(date, facilityTimezone);
        facilityEnd = dateUtils.getEndOfMonth(date, facilityTimezone);
        break;
      case 'week':
        facilityStart = dateUtils.getStartOfWeek(date, facilityTimezone);
        facilityEnd = dateUtils.getEndOfWeek(date, facilityTimezone);
        break;
      case 'day':
        facilityStart = dateUtils.getStartOfDay(date, facilityTimezone);
        facilityEnd = dateUtils.getEndOfDay(date, facilityTimezone);
        break;
      default:
        facilityStart = date;
        facilityEnd = date;
    }
    
    // Convert to UTC for API query
    const utcStart = dateUtils.convertFacilityTimeToUTC(facilityStart, facilityTimezone);
    const utcEnd = dateUtils.convertFacilityTimeToUTC(facilityEnd, facilityTimezone);
    
    return {
      start: utcStart,
      end: utcEnd
    };
  },

  // Get status color mapping
  getStatusColorMap() {
    return {
      'available': '#FFFFFF',
      'assigned': '#FFEB3B',
      'pending': '#FFEB3B',
      'booked': '#4CAF50',
      'maintenance': '#9E9E9E',
      'cancelled': '#9E9E9E'
    };
  },

  // Get admin-specific status color
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