// frontend/src/services/calendarService.js - Enhanced with Optimistic Updates
import api from './api';
import { dateUtils } from '../utils/dateUtils';

// Event state management for optimistic updates
const eventStateManager = {
  // Track event states (loading, error, etc.)
  eventStates: new Map(),
  
  // Event listeners for real-time updates
  listeners: new Set(),
  
  // Set event state
  setEventState(eventId, state) {
    this.eventStates.set(eventId, { ...this.eventStates.get(eventId), ...state });
    this.notifyListeners({ type: 'stateChange', eventId, state });
  },
  
  // Get event state
  getEventState(eventId) {
    return this.eventStates.get(eventId) || { loading: false, error: null, syncing: false };
  },
  
  // Add listener for state changes
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  },
  
  // Notify all listeners
  notifyListeners(update) {
    this.listeners.forEach(callback => callback(update));
  },
  
  // Clear state for event
  clearEventState(eventId) {
    this.eventStates.delete(eventId);
  }
};

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
  // Event state manager (exposed for components)
  eventStateManager,

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
        end: new Date(event.end),
        // Ensure we have all necessary extended props
        extendedProps: {
          ...event.extendedProps,
          episodeId: event.extendedProps?.episodeId || event.id,
          status: event.extendedProps?.status || 'available',
          resource: event.extendedProps?.resource || event.title,
          price: event.extendedProps?.price || 0,
          // Add state tracking
          ...eventStateManager.getEventState(event.extendedProps?.episodeId || event.id)
        }
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

  // OPTIMISTIC CREATE: Add event immediately, then sync with server
  async createEventOptimistic(eventData, onOptimisticUpdate) {
    // Generate temporary ID for optimistic update
    const tempId = `temp_${Date.now()}`;
    const tempEpisodeId = `temp_episode_${Date.now()}`;
    
    try {
      console.log('Calendar Service - Creating event optimistically:', eventData);
      
      // Validate required fields
      if (!eventData.resource_id || !eventData.event_start_date_time || !eventData.event_end_date_time) {
        throw new Error('Missing required fields');
      }
      
      // Create optimistic event object
      const optimisticEvent = {
        id: tempId,
        title: eventData.episode_data?.episode_title || 'New Ice Time',
        start: new Date(eventData.event_start_date_time),
        end: new Date(eventData.event_end_date_time),
        resourceId: eventData.resource_id.toString(),
        backgroundColor: '#e6f3ff',
        borderColor: '#4299e1',
        textColor: '#2d3748',
        extendedProps: {
          episodeId: tempEpisodeId,
          status: 'available',
          resource: 'Loading...',
          price: eventData.episode_data?.episode_price || 0,
          loading: true,
          isOptimistic: true
        }
      };
      
      // Set loading state
      eventStateManager.setEventState(tempEpisodeId, { loading: true, syncing: true });
      
      // Add optimistic event to calendar immediately
      if (onOptimisticUpdate) {
        onOptimisticUpdate({ type: 'add', event: optimisticEvent });
      }
      
      // Send to server using existing createEvent endpoint
      const operation = () => api.post('/api/events', eventData);
      const response = await retryOperation(operation);
      
      if (response.data && response.data.events) {
        // Replace optimistic event with real server data
        const serverEvents = response.data.events.map(event => ({
          ...event,
          start: new Date(event.start),
          end: new Date(event.end),
          extendedProps: {
            ...event.extendedProps,
            episodeId: event.extendedProps?.episodeId || event.id,
            loading: false,
            isOptimistic: false
          }
        }));
        
        // Clear temporary state
        eventStateManager.clearEventState(tempEpisodeId);
        
        // Update calendar with real events
        if (onOptimisticUpdate) {
          onOptimisticUpdate({ 
            type: 'replace', 
            tempId: tempId,
            events: serverEvents 
          });
        }
        
        return { success: true, data: { events: serverEvents } };
      } else {
        throw new Error(response.data?.error || 'Server did not return events');
      }
      
    } catch (error) {
      console.error('Create event error:', error);
      
      // Remove optimistic event on failure
      if (onOptimisticUpdate) {
        onOptimisticUpdate({ 
          type: 'remove', 
          tempId: tempId,
          error: error.response?.data?.message || error.message || 'Failed to create event'
        });
      }
      
      // Clear loading state
      eventStateManager.clearEventState(tempEpisodeId);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to create event'
      };
    }
  },

  // OPTIMISTIC UPDATE: Update event immediately, then sync with server
  async updateEpisodeOptimistic(episodeId, updateData, onOptimisticUpdate) {
    const originalState = eventStateManager.getEventState(episodeId);
    
    try {
      // Set loading state
      eventStateManager.setEventState(episodeId, { loading: true, syncing: true });
      
      // Apply optimistic update immediately
      if (onOptimisticUpdate) {
        onOptimisticUpdate({ 
          type: 'update', 
          episodeId,
          updates: {
            ...updateData,
            extendedProps: {
              loading: true,
              syncing: true
            }
          }
        });
      }
      
      // Send to server using existing updateEpisode endpoint
      const operation = () => api.put(`/api/episodes/${episodeId}`, updateData);
      const response = await retryOperation(operation);
      
      if (response.data && response.data.message) {
        // Apply final server updates
        eventStateManager.setEventState(episodeId, { loading: false, syncing: false });
        
        if (onOptimisticUpdate) {
          onOptimisticUpdate({ 
            type: 'updateComplete', 
            episodeId,
            data: response.data.episode,
            updates: {
              extendedProps: {
                loading: false,
                syncing: false
              }
            }
          });
        }
        
        return { success: true, data: response.data };
      } else {
        throw new Error(response.data?.error || 'Update failed');
      }
      
    } catch (error) {
      console.error('Update episode error:', error);
      
      // Rollback optimistic changes
      eventStateManager.setEventState(episodeId, { 
        ...originalState, 
        error: error.response?.data?.message || error.message || 'Update failed' 
      });
      
      if (onOptimisticUpdate) {
        onOptimisticUpdate({ 
          type: 'rollback', 
          episodeId,
          error: error.response?.data?.message || error.message || 'Failed to update episode'
        });
      }
      
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to update episode'
      };
    }
  },

  // OPTIMISTIC DELETE: Remove event immediately, then sync with server
  async deleteEpisodeOptimistic(episodeId, onOptimisticUpdate) {
    let removedEvent = null;
    
    try {
      // Set loading state
      eventStateManager.setEventState(episodeId, { loading: true, syncing: true });
      
      // Remove event optimistically
      if (onOptimisticUpdate) {
        removedEvent = onOptimisticUpdate({ 
          type: 'remove', 
          episodeId,
          optimistic: true
        });
      }
      
      // Send delete request to server using existing endpoint
      const operation = () => api.delete(`/api/episodes/${episodeId}`);
      const response = await retryOperation(operation);
      
      if (response.data && response.data.message) {
        // Confirm deletion
        eventStateManager.clearEventState(episodeId);
        
        if (onOptimisticUpdate) {
          onOptimisticUpdate({ 
            type: 'deleteComplete', 
            episodeId
          });
        }
        
        return { success: true, data: response.data };
      } else {
        throw new Error(response.data?.error || 'Delete failed');
      }
      
    } catch (error) {
      console.error('Delete episode error:', error);
      
      // Restore event on failure
      if (removedEvent && onOptimisticUpdate) {
        onOptimisticUpdate({ 
          type: 'restore', 
          event: {
            ...removedEvent,
            extendedProps: {
              ...removedEvent.extendedProps,
              loading: false,
              error: error.response?.data?.message || error.message || 'Delete failed'
            }
          }
        });
      }
      
      eventStateManager.setEventState(episodeId, { 
        loading: false, 
        error: error.response?.data?.message || error.message || 'Delete failed' 
      });
      
      if (error.response?.status === 400) {
        return {
          success: false,
          error: 'Cannot delete episode with existing bookings'
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to delete episode'
      };
    }
  },

  // OPTIMISTIC MOVE: Update position immediately, then sync with server
  async moveEpisodeOptimistic(episodeId, newStartTime, newEndTime, onOptimisticUpdate) {
    const originalState = eventStateManager.getEventState(episodeId);
    let originalPosition = null;
    
    try {
      // Set loading state
      eventStateManager.setEventState(episodeId, { loading: true, syncing: true });
      
      // Validate move first to reduce failures
      const validation = await this.validateEpisodeMove(episodeId, newStartTime, newEndTime);
      if (!validation.success || !validation.data.isValid) {
        throw new Error(validation.data?.conflicts?.[0]?.description || 'Move validation failed');
      }
      
      // Apply move optimistically
      if (onOptimisticUpdate) {
        originalPosition = onOptimisticUpdate({ 
          type: 'move', 
          episodeId,
          newStart: new Date(newStartTime),
          newEnd: new Date(newEndTime),
          optimistic: true
        });
      }
      
      // Send to server with retry logic
      const operation = () => api.put(`/api/episodes/${episodeId}/move`, {
        new_start_time: newStartTime,
        new_end_time: newEndTime
      });
      
      const response = await retryOperation(operation);
      
      if (response.data && response.data.message) {
        // Confirm move
        eventStateManager.setEventState(episodeId, { loading: false, syncing: false });
        
        if (onOptimisticUpdate) {
          onOptimisticUpdate({ 
            type: 'moveComplete', 
            episodeId,
            serverData: response.data.episode
          });
        }
        
        return { success: true, data: response.data };
      } else {
        throw new Error(response.data?.error || 'Move failed');
      }
      
    } catch (error) {
      console.error('Move episode error:', error);
      
      // Revert position on failure
      if (originalPosition && onOptimisticUpdate) {
        onOptimisticUpdate({ 
          type: 'revert', 
          episodeId,
          originalStart: originalPosition.start,
          originalEnd: originalPosition.end
        });
      }
      
      eventStateManager.setEventState(episodeId, { 
        ...originalState, 
        error: error.response?.data?.message || error.message || 'Move failed' 
      });
      
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to move episode'
      };
    }
  },

  // OPTIMISTIC RESIZE: Update size immediately, then sync with server
  async resizeEpisodeOptimistic(episodeId, newEndTime, onOptimisticUpdate) {
    const originalState = eventStateManager.getEventState(episodeId);
    let originalEnd = null;
    
    try {
      // Set loading state
      eventStateManager.setEventState(episodeId, { loading: true, syncing: true });
      
      // Basic validation for resize
      const now = new Date();
      const newEnd = new Date(newEndTime);
      if (newEnd <= now) {
        throw new Error('Cannot resize to past time');
      }
      
      // Apply resize optimistically
      if (onOptimisticUpdate) {
        originalEnd = onOptimisticUpdate({ 
          type: 'resize', 
          episodeId,
          newEnd: new Date(newEndTime),
          optimistic: true
        });
      }
      
      // Send to server with retry logic
      const operation = () => api.put(`/api/episodes/${episodeId}/resize`, {
        new_end_time: newEndTime
      });
      
      const response = await retryOperation(operation);
      
      if (response.data && response.data.message) {
        // Confirm resize
        eventStateManager.setEventState(episodeId, { loading: false, syncing: false });
        
        if (onOptimisticUpdate) {
          onOptimisticUpdate({ 
            type: 'resizeComplete', 
            episodeId,
            serverData: response.data.episode
          });
        }
        
        return { success: true, data: response.data };
      } else {
        throw new Error(response.data?.error || 'Resize failed');
      }
      
    } catch (error) {
      console.error('Resize episode error:', error);
      
      // Revert size on failure
      if (originalEnd && onOptimisticUpdate) {
        onOptimisticUpdate({ 
          type: 'revert', 
          episodeId,
          originalEnd: originalEnd
        });
      }
      
      eventStateManager.setEventState(episodeId, { 
        ...originalState, 
        error: error.response?.data?.message || error.message || 'Resize failed' 
      });
      
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to resize episode'
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
        error: error.response?.data?.message || error.message || 'Failed to fetch episode details'
      };
    }
  },

  // Validate episode move/resize
  async validateEpisodeMove(episodeId, newStartTime, newEndTime, facilityId) {
    try {
      const operation = () => api.post('/api/episodes/validate-move', {
        episode_id: episodeId,
        new_start_time: newStartTime,
        new_end_time: newEndTime,
        facility_id: facilityId
      });
      
      const response = await retryOperation(operation);
      
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
        error: error.response?.data?.message || error.message || 'Failed to validate move'
      };
    }
  },

  // Legacy methods (maintain for backward compatibility)
  async createEvent(eventData) {
    try {
      const operation = () => api.post('/api/events', eventData);
      const response = await retryOperation(operation);
      
      if (response.data && response.data.events) {
        return { success: true, data: response.data };
      } else {
        throw new Error(response.data?.error || 'Failed to create event');
      }
    } catch (error) {
      console.error('Create event error:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to create event'
      };
    }
  },

  async updateEpisode(episodeId, updateData) {
    try {
      const operation = () => api.put(`/api/episodes/${episodeId}`, updateData);
      const response = await retryOperation(operation);
      
      if (response.data && response.data.message) {
        return { success: true, data: response.data };
      } else {
        throw new Error(response.data?.error || 'Failed to update episode');
      }
    } catch (error) {
      console.error('Update episode error:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to update episode'
      };
    }
  },

  async deleteEpisode(episodeId) {
    try {
      const operation = () => api.delete(`/api/episodes/${episodeId}`);
      const response = await retryOperation(operation);
      
      if (response.data && response.data.message) {
        return { success: true, data: response.data };
      } else {
        throw new Error(response.data?.error || 'Failed to delete episode');
      }
    } catch (error) {
      console.error('Delete episode error:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to delete episode'
      };
    }
  },

  async moveEpisode(episodeId, newStartTime, newEndTime) {
    try {
      const operation = () => api.put(`/api/episodes/${episodeId}/move`, {
        new_start_time: newStartTime,
        new_end_time: newEndTime
      });
      
      const response = await retryOperation(operation);
      
      if (response.data && response.data.message) {
        return { success: true, data: response.data };
      } else {
        throw new Error(response.data?.error || 'Failed to move episode');
      }
    } catch (error) {
      console.error('Move episode error:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to move episode'
      };
    }
  },

  async resizeEpisode(episodeId, newEndTime) {
    try {
      const operation = () => api.put(`/api/episodes/${episodeId}/resize`, {
        new_end_time: newEndTime
      });
      
      const response = await retryOperation(operation);
      
      if (response.data && response.data.message) {
        return { success: true, data: response.data };
      } else {
        throw new Error(response.data?.error || 'Failed to resize episode');
      }
    } catch (error) {
      console.error('Resize episode error:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to resize episode'
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

  // Delete event (optimistic version)
  async deleteEventOptimistic(eventId, onOptimisticUpdate) {
    let removedEvents = [];
    
    try {
      // Remove events optimistically (events can have multiple episodes)
      if (onOptimisticUpdate) {
        removedEvents = onOptimisticUpdate({ 
          type: 'removeEvent', 
          eventId,
          optimistic: true
        });
      }
      
      // Send delete request
      const response = await api.delete(`/api/events/${eventId}`);
      
      if (response.data.success) {
        // Confirm deletion
        if (onOptimisticUpdate) {
          onOptimisticUpdate({ 
            type: 'deleteEventComplete', 
            eventId
          });
        }
        
        return { success: true, data: response.data };
      } else {
        throw new Error('Delete failed');
      }
      
    } catch (error) {
      console.error('Delete event error:', error);
      
      // Restore events on failure
      if (removedEvents.length > 0 && onOptimisticUpdate) {
        onOptimisticUpdate({ 
          type: 'restoreEvents', 
          events: removedEvents.map(event => ({
            ...event,
            extendedProps: {
              ...event.extendedProps,
              error: error.response?.data?.message || 'Delete failed'
            }
          }))
        });
      }
      
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

  // Get status color mapping for reference
  getStatusColorMap() {
    return {
      'available': {
        backgroundColor: '#FFFFFF',
        borderColor: '#CBD5E0',
        textColor: '#2D3748'
      },
      'assigned': {
        backgroundColor: '#FFEB3B',
        borderColor: '#F9A825',
        textColor: '#1A202C'
      },
      'pending': {
        backgroundColor: '#FFEB3B',
        borderColor: '#F9A825',
        textColor: '#1A202C'
      },
      'booked': {
        backgroundColor: '#4CAF50',
        borderColor: '#388E3C',
        textColor: '#FFFFFF'
      },
      'maintenance': {
        backgroundColor: '#9E9E9E',
        borderColor: '#616161',
        textColor: '#FFFFFF'
      },
      'cancelled': {
        backgroundColor: '#9E9E9E',
        borderColor: '#616161',
        textColor: '#FFFFFF'
      }
    };
  },

  // Get admin-specific status color (blue for assigned reserved)
  getAdminStatusColor(episode, isAdmin = false) {
    if (isAdmin && episode.status === 'assigned' && episode.extendedProps?.assignedProgram) {
      return {
        backgroundColor: '#2196F3',
        borderColor: '#1976D2',
        textColor: '#FFFFFF'
      };
    }
    return this.getStatusColorMap()[episode.status] || this.getStatusColorMap()['available'];
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

    // Cannot edit if currently syncing
    if (episode.extendedProps?.syncing) {
      return { allowed: false, reason: 'Episode is currently being updated' };
    }
    
    return { allowed: true };
  },

  // Batch validation for multiple moves (for future use)
  async validateBatchMoves(moves) {
    try {
      const response = await api.post('/api/episodes/validate-batch-moves', { moves });
      
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
  }
};

export default calendarService;