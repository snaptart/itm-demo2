import api from './api';

const facilityService = {
  // Get all facilities with pagination and search
  async getFacilities(params = {}) {
    try {
      const response = await api.get('/api/facilities', { params });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch facilities'
      };
    }
  },

  // Get single facility by ID
  async getFacilityById(id) {
    try {
      const response = await api.get(`/api/facilities/${id}`);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch facility'
      };
    }
  },

  // Create new facility
  async createFacility(facilityData) {
    try {
      const response = await api.post('/api/facilities', facilityData);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to create facility'
      };
    }
  },

  // Update facility
  async updateFacility(id, facilityData) {
    try {
      const response = await api.put(`/api/facilities/${id}`, facilityData);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to update facility'
      };
    }
  },

  // Delete facility
  async deleteFacility(id) {
    try {
      const response = await api.delete(`/api/facilities/${id}`);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to delete facility'
      };
    }
  },

  // Get facility statistics
  async getFacilityStats(id) {
    try {
      const response = await api.get(`/api/facilities/${id}/stats`);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch facility statistics'
      };
    }
  }
};

export default facilityService;