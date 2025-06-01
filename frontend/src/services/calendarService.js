// frontend/src/services/calendarService.js (Fixed for proper drag-drop)
import api from './api';

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
  // Get episodes for calendar view
  async getEpisodes(params = {}, options = {}) {
    try {
      const operation = () => api.get('/api/episodes', { 
        params,
        signal: options.signal // Support request cancellation
      });
      
      const response = await retryOperation(operation);
      return { success: true, data: response.data };
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

  // Move episode with drag and drop
  async moveEpisode(episodeId, newStartTime, newEndTime) {
    try {
      // Calculate new duration
      const duration = Math.round((new Date(newEndTime) - new Date(newStartTime)) / (1000 * 60));

      const response = await api.put(`/api/episodes/${episodeId}/move`, {
        new_start_time: newStartTime,
        new_end_time: newEndTime,
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

  // Resize episode
  async resizeEpisode(episodeId, newEndTime) {
    try {
      // Get current episode to calculate duration
      const episodeResult = await this.getEpisodeById(episodeId);
      if (!episodeResult.success) {
        throw new Error('Failed to get episode details');
      }

      const startTime = episodeResult.data.episode.episode_start_date_time;
      const duration = Math.round((new Date(newEndTime) - new Date(startTime)) / (1000 * 60));

      const response = await api.put(`/api/episodes/${episodeId}/resize`, {
        new_end_time: newEndTime,
        new_duration: duration
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
  async validateBatchMoves(moves) {
    try {
      const response = await api.post('/api/episodes/validate-batch-moves', {
        moves: moves.map(move => ({
          episode_id: move.episodeId,
          new_start_time: move.newStartTime,
          new_end_time: move.newEndTime
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

  // Create new episode (Admin only)
  async createEpisode(episodeData) {
    try {
      // Validate required fields
      if (!episodeData.event_id || !episodeData.episode_start_date_time || !episodeData.episode_end_date_time) {
        return { 
          success: false, 
          error: 'Missing required fields' 
        };
      }
      
      const response = await api.post('/api/episodes', episodeData);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Create episode error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to create episode'
      };
    }
  },

  // Update episode (Admin only)
  async updateEpisode(id, episodeData) {
    try {
      // Clean up the data before sending
      const cleanData = {};
      
      // Only include fields that are defined
      if (episodeData.episode_title !== undefined) {
        cleanData.episode_title = episodeData.episode_title?.trim();
      }
      
      if (episodeData.episode_description !== undefined) {
        cleanData.episode_description = episodeData.episode_description?.trim();
      }
      
      if (episodeData.episode_price !== undefined) {
        cleanData.episode_price = episodeData.episode_price;
      }
      
      if (episodeData.episode_status !== undefined) {
        cleanData.episode_status = episodeData.episode_status;
      }

      // Handle datetime updates for drag-drop
      if (episodeData.episode_start_date_time !== undefined) {
        cleanData.episode_start_date_time = episodeData.episode_start_date_time;
      }

      if (episodeData.episode_end_date_time !== undefined) {
        cleanData.episode_end_date_time = episodeData.episode_end_date_time;
      }
      
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

  // Create new event with episodes (Admin only)
  async createEvent(eventData) {
    try {
      // Validate required fields
      if (!eventData.resource_id || !eventData.event_start_date_time || !eventData.event_end_date_time) {
        return { 
          success: false, 
          error: 'Missing required fields' 
        };
      }
      
      // Validate dates
      const startDate = new Date(eventData.event_start_date_time);
      const endDate = new Date(eventData.event_end_date_time);
      
      if (startDate >= endDate) {
        return { 
          success: false, 
          error: 'End time must be after start time' 
        };
      }
      
      if (eventData.repeat_mode !== 'once' && eventData.repeat_end_date) {
        const repeatEnd = new Date(eventData.repeat_end_date);
        if (repeatEnd <= startDate) {
          return { 
            success: false, 
            error: 'Repeat end date must be after start date' 
          };
        }
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
    return date.toISOString();
  },

  // Helper function to get calendar date range
  getCalendarDateRange(view, date) {
    const start = new Date(date);
    const end = new Date(date);

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
      start: this.formatDateForAPI(start),
      end: this.formatDateForAPI(end)
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

  // Validate episode data before submission
  validateEpisodeData(data) {
    const errors = {};
    
    if (!data.episode_title?.trim()) {
      errors.episode_title = 'Title is required';
    }
    
    if (data.episode_price !== undefined && data.episode_price !== null && data.episode_price < 0) {
      errors.episode_price = 'Price cannot be negative';
    }
    
    if (data.episode_start_date_time && data.episode_end_date_time) {
      const start = new Date(data.episode_start_date_time);
      const end = new Date(data.episode_end_date_time);
      
      if (start >= end) {
        errors.date = 'End time must be after start time';
      }
      
      if (start < new Date()) {
        errors.date = 'Cannot create episodes in the past';
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

  // Smart snap to grid helper
  snapToGrid(dateTime, snapDuration = 15) {
    const date = new Date(dateTime);
    const minutes = date.getMinutes();
    const snappedMinutes = Math.round(minutes / snapDuration) * snapDuration;
    
    date.setMinutes(snappedMinutes);
    date.setSeconds(0);
    date.setMilliseconds(0);
    
    return date;
  },

  // Check if time is within business hours
  isWithinBusinessHours(startTime, endTime, facilitySchedule) {
    if (!facilitySchedule) return true;
    
    const dayOfWeek = startTime.getDay();
    const daySchedule = facilitySchedule[dayOfWeek];
    
    if (!daySchedule || daySchedule.isClosed) return false;
    
    const startHour = startTime.getHours() + startTime.getMinutes() / 60;
    const endHour = endTime.getHours() + endTime.getMinutes() / 60;
    
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
      PAST_DATE: 'past_date'
    };
  },

  // Format conflict message
  formatConflictMessage(conflict) {
    const messages = {
      overlap: 'Time slot overlaps with existing ice time',
      business_hours: 'Time is outside facility business hours',
      facility_closed: 'Facility is closed at this time',
      resource_unavailable: 'Resource is not available',
      duration_invalid: 'Duration is too short or too long',
      past_date: 'Cannot schedule in the past'
    };
    
    return messages[conflict.type] || conflict.message || 'Schedule conflict detected';
  }
};

export default calendarService;