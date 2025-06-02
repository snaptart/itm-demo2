// frontend/src/services/calendarService.js (Simplified - Local Time)
import api from './api';
import { dateUtils } from '../utils/dateUtils';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

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
  // Get episodes for calendar view - no timezone conversion
  async getEpisodes(params = {}, options = {}) {
    try {
      const operation = () => api.get('/api/episodes', { 
        params,
        signal: options.signal
      });
      
      const response = await retryOperation(operation);
      
      // Process events - times are already in local timezone
      const processedEvents = response.data.events?.map(event => ({
        ...event,
        // Ensure dates are Date objects for FullCalendar
        start: new Date(event.start),
        end: new Date(event.end)
      })) || [];

      return { 
        success: true, 
        data: {
          ...response.data,
          events: processedEvents
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
  async getEpisodeById(id) {
    try {
      const operation = () => api.get(`/api/episodes/${id}`);
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

  // Create new event - send local times
  async createEvent(eventData) {
    try {
      console.log('Calendar Service - Creating event with data:', eventData);
      
      // Validate required fields
      if (!eventData.resource_id || !eventData.event_start_date_time || !eventData.event_end_date_time) {
        return { 
          success: false, 
          error: 'Missing required fields' 
        };
      }
      
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

  // Move episode - send local times
  async moveEpisode(episodeId, newStartTime, newEndTime) {
    try {
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

  // Resize episode - send local times
  async resizeEpisode(episodeId, newEndTime) {
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
  async validateEpisodeMove(episodeId, newStartTime, newEndTime, facilityId) {
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

  // Helper function to get calendar date range
  getCalendarDateRange(view, date) {
    let start, end;
    
    switch (view) {
      case 'month':
        start = dateUtils.getStartOfMonth(date);
        end = dateUtils.getEndOfMonth(date);
        break;
      case 'week':
        start = dateUtils.getStartOfWeek(date);
        end = dateUtils.getEndOfWeek(date);
        break;
      case 'day':
        start = dateUtils.getStartOfDay(date);
        end = dateUtils.getEndOfDay(date);
        break;
      default:
        start = date;
        end = date;
    }
    
    return {
      start: dateUtils.formatForAPI(start),
      end: dateUtils.formatForAPI(end)
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
  }
};

export default calendarService;