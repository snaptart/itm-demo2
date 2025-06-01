// frontend/src/services/calendarService.js (Enhanced with Comprehensive Timezone Support)
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
  // Get episodes for calendar view with comprehensive timezone support
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
          timezone: facilityTimezone // Pass facility timezone preference
        },
        signal: options.signal, // Support request cancellation
        headers: {
          'X-Client-Timezone': options.clientTimezone || dateUtils.DEFAULT_TIMEZONE,
          'X-Facility-Timezone': facilityTimezone || dateUtils.DEFAULT_TIMEZONE
        }
      });
      
      const response = await retryOperation(operation);
      
      // Process events for timezone display
      const processedEvents = response.data.events?.map(event => {
        return this.enhanceEventWithTimezone(event, facilityTimezone);
      }) || [];

      return { 
        success: true, 
        data: {
          ...response.data,
          events: processedEvents,
          facilityTimezone: response.data.timezone || facilityTimezone // Server returns facility timezone
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

  // Enhance event with timezone information
  enhanceEventWithTimezone(event, facilityTimezone) {
    if (!event || !facilityTimezone) return event;

    try {
      return {
        ...event,
        extendedProps: {
          ...event.extendedProps,
          facilityTimezone,
          displayStartTime: dateUtils.formatTimeOnly(event.start, facilityTimezone),
          displayEndTime: dateUtils.formatTimeOnly(event.end, facilityTimezone),
          displayDate: dateUtils.formatDateOnly(event.start, facilityTimezone),
          displayDuration: dateUtils.formatDuration(
            dateUtils.getDuration(event.start, event.end)
          ),
          timezoneDisplay: dateUtils.getTimezoneDisplayName(facilityTimezone),
          // Enhanced timezone validation
          isWithinBusinessHours: this.validateBusinessHours(
            event.start, 
            event.end, 
            event.extendedProps.facility,
            facilityTimezone
          ),
          dstInfo: this.getDSTInfo(event.start, facilityTimezone)
        }
      };
    } catch (error) {
      console.error('Enhance event with timezone failed:', error);
      return event;
    }
  },

  // Get calendar resources (facilities and rinks) with timezone info
  async getCalendarResources(params = {}) {
    try {
      const operation = () => api.get('/api/episodes/resources', { params });
      const response = await retryOperation(operation);
      
      // Enhance resources with timezone information
      const enhancedResources = response.data.resources?.map(resource => ({
        ...resource,
        timezoneInfo: {
          timezone: resource.facilityTimezone,
          displayName: dateUtils.getTimezoneDisplayName(resource.facilityTimezone),
          currentTime: dateUtils.formatForDisplay(
            new Date(), 
            resource.facilityTimezone,
            { hour: 'numeric', minute: '2-digit', hour12: true }
          )
        }
      })) || [];

      return { 
        success: true, 
        data: {
          ...response.data,
          resources: enhancedResources
        }
      };
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
        params: { timezone },
        headers: {
          'X-Client-Timezone': timezone || dateUtils.DEFAULT_TIMEZONE
        }
      });
      const response = await retryOperation(operation);
      
      // Enhance episode with timezone information
      const episode = response.data.episode;
      if (episode && timezone) {
        episode.timezoneInfo = {
          facilityTimezone: timezone,
          displayStartTime: dateUtils.formatForDisplay(episode.episode_start_date_time, timezone),
          displayEndTime: dateUtils.formatForDisplay(episode.episode_end_date_time, timezone),
          duration: dateUtils.formatDuration(episode.episode_duration),
          relativeTime: dateUtils.getRelativeTime(episode.episode_start_date_time, timezone),
          businessHoursStatus: this.validateBusinessHours(
            episode.episode_start_date_time,
            episode.episode_end_date_time,
            episode.event?.resource?.facility,
            timezone
          )
        };
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

  // Validate episode move/resize with comprehensive timezone conversion
  async validateEpisodeMove(episodeId, newStartTime, newEndTime, facilityId, facilityTimezone = null) {
    try {
      // Get facility timezone if not provided
      if (!facilityTimezone && facilityId) {
        facilityTimezone = await this.getFacilityTimezone(facilityId);
      }

      // Convert times to facility timezone for proper validation
      let convertedStartTime = newStartTime;
      let convertedEndTime = newEndTime;
      
      if (facilityTimezone) {
        // Ensure times are in the correct timezone context
        convertedStartTime = dateUtils.formatForAPI(
          dateUtils.createFacilityDateTime(
            dateUtils.extractDateString(newStartTime, facilityTimezone),
            dateUtils.extractTimeString(newStartTime, facilityTimezone),
            facilityTimezone
          )
        );
        convertedEndTime = dateUtils.formatForAPI(
          dateUtils.createFacilityDateTime(
            dateUtils.extractDateString(newEndTime, facilityTimezone),
            dateUtils.extractTimeString(newEndTime, facilityTimezone),
            facilityTimezone
          )
        );
      }

      const response = await api.post('/api/episodes/validate-move', {
        episode_id: episodeId,
        new_start_time: convertedStartTime,
        new_end_time: convertedEndTime,
        facility_id: facilityId
      }, {
        headers: {
          'X-Facility-Timezone': facilityTimezone || dateUtils.DEFAULT_TIMEZONE
        }
      });
      
      return { 
        success: true, 
        data: {
          isValid: response.data.valid,
          conflicts: this.enhanceConflictsWithTimezone(response.data.conflicts || [], facilityTimezone),
          warnings: this.enhanceWarningsWithTimezone(response.data.warnings || [], facilityTimezone),
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

  // Enhance conflicts with timezone information
  enhanceConflictsWithTimezone(conflicts, facilityTimezone) {
    if (!facilityTimezone) return conflicts;

    return conflicts.map(conflict => ({
      ...conflict,
      displayTime: conflict.time ? dateUtils.formatForDisplay(
        conflict.time,
        facilityTimezone,
        { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }
      ) : null,
      timezoneContext: dateUtils.getTimezoneDisplayName(facilityTimezone)
    }));
  },

  // Enhance warnings with timezone information
  enhanceWarningsWithTimezone(warnings, facilityTimezone) {
    if (!facilityTimezone) return warnings;

    return warnings.map(warning => ({
      ...warning,
      displayTime: warning.time ? dateUtils.formatForDisplay(
        warning.time,
        facilityTimezone,
        { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }
      ) : null,
      timezoneContext: dateUtils.getTimezoneDisplayName(facilityTimezone)
    }));
  },

  // Move episode with drag and drop and comprehensive timezone support
  async moveEpisode(episodeId, newStartTime, newEndTime, facilityTimezone = null) {
    try {
      // Convert times if facility timezone is provided
      let convertedStartTime = newStartTime;
      let convertedEndTime = newEndTime;
      
      if (facilityTimezone) {
        convertedStartTime = dateUtils.formatForAPI(
          dateUtils.createFacilityDateTime(
            dateUtils.extractDateString(newStartTime, facilityTimezone),
            dateUtils.extractTimeString(newStartTime, facilityTimezone),
            facilityTimezone
          )
        );
        convertedEndTime = dateUtils.formatForAPI(
          dateUtils.createFacilityDateTime(
            dateUtils.extractDateString(newEndTime, facilityTimezone),
            dateUtils.extractTimeString(newEndTime, facilityTimezone),
            facilityTimezone
          )
        );
      }

      // Calculate new duration with DST awareness
      const duration = facilityTimezone ? 
        dateUtils.getDuration(
          dateUtils.createFacilityDateTime(
            dateUtils.extractDateString(convertedStartTime, facilityTimezone),
            dateUtils.extractTimeString(convertedStartTime, facilityTimezone),
            facilityTimezone
          ),
          dateUtils.createFacilityDateTime(
            dateUtils.extractDateString(convertedEndTime, facilityTimezone),
            dateUtils.extractTimeString(convertedEndTime, facilityTimezone),
            facilityTimezone
          )
        ) :
        Math.round((new Date(convertedEndTime) - new Date(convertedStartTime)) / (1000 * 60));

      const response = await api.put(`/api/episodes/${episodeId}/move`, {
        new_start_time: convertedStartTime,
        new_end_time: convertedEndTime,
        new_duration: duration
      }, {
        headers: {
          'X-Facility-Timezone': facilityTimezone || dateUtils.DEFAULT_TIMEZONE
        }
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
        convertedEndTime = dateUtils.formatForAPI(
          dateUtils.createFacilityDateTime(
            dateUtils.extractDateString(newEndTime, facilityTimezone),
            dateUtils.extractTimeString(newEndTime, facilityTimezone),
            facilityTimezone
          )
        );
      }

      const response = await api.put(`/api/episodes/${episodeId}/resize`, {
        new_end_time: convertedEndTime
      }, {
        headers: {
          'X-Facility-Timezone': facilityTimezone || dateUtils.DEFAULT_TIMEZONE
        }
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

  // Batch validate multiple moves with timezone support
  async validateBatchMoves(moves, facilityTimezone = null) {
    try {
      // Convert times for all moves if facility timezone is provided
      const convertedMoves = moves.map(move => {
        if (facilityTimezone) {
          return {
            ...move,
            newStartTime: dateUtils.formatForAPI(
              dateUtils.createFacilityDateTime(
                dateUtils.extractDateString(move.newStartTime, facilityTimezone),
                dateUtils.extractTimeString(move.newStartTime, facilityTimezone),
                facilityTimezone
              )
            ),
            newEndTime: dateUtils.formatForAPI(
              dateUtils.createFacilityDateTime(
                dateUtils.extractDateString(move.newEndTime, facilityTimezone),
                dateUtils.extractTimeString(move.newEndTime, facilityTimezone),
                facilityTimezone
              )
            )
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
      }, {
        headers: {
          'X-Facility-Timezone': facilityTimezone || dateUtils.DEFAULT_TIMEZONE
        }
      });

      return { 
        success: true, 
        data: {
          isValid: response.data.valid,
          results: response.data.results?.map(result => ({
            ...result,
            conflicts: this.enhanceConflictsWithTimezone(result.conflicts || [], facilityTimezone),
            warnings: this.enhanceWarningsWithTimezone(result.warnings || [], facilityTimezone)
          })) || [],
          overallConflicts: this.enhanceConflictsWithTimezone(
            response.data.overallConflicts || [], 
            facilityTimezone
          )
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

  // Create new episode (Admin only) with comprehensive timezone support
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
        convertedData.episode_start_date_time = dateUtils.formatForAPI(
          dateUtils.createFacilityDateTime(
            dateUtils.extractDateString(episodeData.episode_start_date_time, facilityTimezone),
            dateUtils.extractTimeString(episodeData.episode_start_date_time, facilityTimezone),
            facilityTimezone
          )
        );
        convertedData.episode_end_date_time = dateUtils.formatForAPI(
          dateUtils.createFacilityDateTime(
            dateUtils.extractDateString(episodeData.episode_end_date_time, facilityTimezone),
            dateUtils.extractTimeString(episodeData.episode_end_date_time, facilityTimezone),
            facilityTimezone
          )
        );
        convertedData.facility_timezone = facilityTimezone;
      }
      
      const response = await api.post('/api/episodes', convertedData, {
        headers: {
          'X-Facility-Timezone': facilityTimezone || dateUtils.DEFAULT_TIMEZONE
        }
      });
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
          convertedData.episode_start_date_time = dateUtils.formatForAPI(
            dateUtils.createFacilityDateTime(
              dateUtils.extractDateString(episodeData.episode_start_date_time, facilityTimezone),
              dateUtils.extractTimeString(episodeData.episode_start_date_time, facilityTimezone),
              facilityTimezone
            )
          );
        }
        if (episodeData.episode_end_date_time) {
          convertedData.episode_end_date_time = dateUtils.formatForAPI(
            dateUtils.createFacilityDateTime(
              dateUtils.extractDateString(episodeData.episode_end_date_time, facilityTimezone),
              dateUtils.extractTimeString(episodeData.episode_end_date_time, facilityTimezone),
              facilityTimezone
            )
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
      
      const response = await api.put(`/api/episodes/${id}`, cleanData, {
        headers: {
          'X-Facility-Timezone': facilityTimezone || dateUtils.DEFAULT_TIMEZONE
        }
      });
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

  // Create new event with episodes (Admin only) with comprehensive timezone support
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
        // Handle different input formats
        if (eventData.event_date && eventData.start_time) {
          // Form input format
          convertedData.event_start_date_time = dateUtils.formatForAPI(
            dateUtils.createFacilityDateTime(eventData.event_date, eventData.start_time, facilityTimezone)
          );
          convertedData.event_end_date_time = dateUtils.formatForAPI(
            dateUtils.createFacilityDateTime(eventData.event_date, eventData.end_time, facilityTimezone)
          );
        } else {
          // Direct datetime format
          convertedData.event_start_date_time = dateUtils.formatForAPI(
            dateUtils.createFacilityDateTime(
              dateUtils.extractDateString(eventData.event_start_date_time, facilityTimezone),
              dateUtils.extractTimeString(eventData.event_start_date_time, facilityTimezone),
              facilityTimezone
            )
          );
          convertedData.event_end_date_time = dateUtils.formatForAPI(
            dateUtils.createFacilityDateTime(
              dateUtils.extractDateString(eventData.event_end_date_time, facilityTimezone),
              dateUtils.extractTimeString(eventData.event_end_date_time, facilityTimezone),
              facilityTimezone
            )
          );
        }
        
        if (eventData.repeat_end_date) {
          convertedData.repeat_end_date = eventData.repeat_end_date;
        }

        convertedData.facility_timezone = facilityTimezone;
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
        const repeatEnd = new Date(convertedData.repeat_end_date + 'T23:59:59');
        if (repeatEnd <= startDate) {
          return { 
            success: false, 
            error: 'Repeat end date must be after the start date' 
          };
        }
      }
      
      const response = await api.post('/api/events', convertedData, {
        headers: {
          'X-Facility-Timezone': facilityTimezone || dateUtils.DEFAULT_TIMEZONE
        }
      });
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

  // Check if episode can be moved/resized with timezone awareness
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

  // Validate business hours with facility context
  validateBusinessHours(startTime, endTime, facility, facilityTimezone) {
    if (!facility || !facilityTimezone) return { isValid: true };

    try {
      const businessStart = facility.facility_daily_start_time || '06:00:00';
      const businessEnd = facility.facility_daily_end_time || '23:00:00';

      const startTimeStr = dateUtils.extractTimeString(startTime, facilityTimezone);
      const endTimeStr = dateUtils.extractTimeString(endTime, facilityTimezone);

      const isValid = startTimeStr >= businessStart.slice(0, 5) && 
                     endTimeStr <= businessEnd.slice(0, 5);

      return {
        isValid,
        businessHours: {
          start: businessStart.slice(0, 5),
          end: businessEnd.slice(0, 5)
        },
        requestedTime: {
          start: startTimeStr,
          end: endTimeStr
        },
        timezone: facilityTimezone
      };
    } catch (error) {
      console.error('Business hours validation failed:', error);
      return { isValid: true };
    }
  },

  // Get DST information for an event
  getDSTInfo(eventTime, facilityTimezone) {
    try {
      const facilityTime = dateUtils.convertToFacilityTime(eventTime, facilityTimezone);
      return {
        isDST: facilityTime.isDST ? facilityTime.isDST() : false,
        offset: facilityTime.format ? facilityTime.format('Z') : '+00:00',
        zoneName: facilityTime.format ? facilityTime.format('z') : 'UTC'
      };
    } catch (error) {
      console.error('Get DST info failed:', error);
      return { isDST: false, offset: '+00:00', zoneName: 'UTC' };
    }
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
    
    return dateUtils.isWithinBusinessHours(startTime, endTime, facilitySchedule, facilityTimezone);
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
  },

  // Preload facility timezones for better performance
  async preloadFacilityTimezones(facilityIds) {
    try {
      const promises = facilityIds.map(async (facilityId) => {
        if (!facilityTimezoneCache.has(facilityId)) {
          const timezone = await this.getFacilityTimezone(facilityId);
          return { facilityId, timezone };
        }
        return null;
      });

      await Promise.all(promises);
    } catch (error) {
      console.error('Preload facility timezones error:', error);
    }
  }
};

export default calendarService;