import api from './api';

const calendarService = {
  // Get episodes for calendar view
  async getEpisodes(params = {}) {
    try {
      const response = await api.get('/api/episodes', { params });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch calendar events'
      };
    }
  },

  // Get calendar resources (facilities and rinks)
  async getCalendarResources(params = {}) {
    try {
      const response = await api.get('/api/episodes/resources', { params });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch calendar resources'
      };
    }
  },

  // Get single episode details
  async getEpisodeById(id) {
    try {
      const response = await api.get(`/api/episodes/${id}`);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch episode details'
      };
    }
  },

  // Create new episode (Admin only)
  async createEpisode(episodeData) {
    try {
      const response = await api.post('/api/episodes', episodeData);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to create episode'
      };
    }
  },

  // Update episode (Admin only)
  async updateEpisode(id, episodeData) {
    try {
      const response = await api.put(`/api/episodes/${id}`, episodeData);
      return { success: true, data: response.data };
    } catch (error) {
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
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to delete episode'
      };
    }
  },

  // Create new event with episodes (Admin only)
  async createEvent(eventData) {
    try {
      const response = await api.post('/api/events', eventData);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to create event'
      };
    }
  },

  // Get events by resource
  async getEventsByResource(resourceId, params = {}) {
    try {
      const response = await api.get(`/api/events/resource/${resourceId}`, { params });
      return { success: true, data: response.data };
    } catch (error) {
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
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to delete event'
      };
    }
  },

  // Helper function to format date for API
  formatDateForAPI(date) {
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
  }
};

export default calendarService;