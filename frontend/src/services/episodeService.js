import api from './api';

const episodeService = {
  // Get episodes with filters
  async getEpisodes(params = {}) {
    try {
      const response = await api.get('/api/episodes', { params });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch ice time slots'
      };
    }
  },

  // Get single episode by ID
  async getEpisodeById(id) {
    try {
      const response = await api.get(`/api/episodes/${id}`);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch ice time slot'
      };
    }
  },

  // Create new episode
  async createEpisode(episodeData) {
    try {
      const response = await api.post('/api/episodes', episodeData);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to create ice time slot'
      };
    }
  },

  // Update episode
  async updateEpisode(id, episodeData) {
    try {
      const response = await api.put(`/api/episodes/${id}`, episodeData);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to update ice time slot'
      };
    }
  },

  // Delete episode
  async deleteEpisode(id) {
    try {
      const response = await api.delete(`/api/episodes/${id}`);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to delete ice time slot'
      };
    }
  },

  // Get available episodes for booking
  async getAvailableEpisodes(params = {}) {
    try {
      const response = await api.get('/api/episodes/available', { params });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch available ice time'
      };
    }
  },

  // Create recurring episodes
  async createRecurringEpisodes(recurringData) {
    try {
      const response = await api.post('/api/episodes/recurring', recurringData);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to create recurring ice time'
      };
    }
  }
};

export default episodeService;