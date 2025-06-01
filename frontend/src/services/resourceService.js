import api from './api';

const resourceService = {
  // Get all resource types
  async getResourceTypes() {
    try {
      const response = await api.get('/api/resources/types');
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch resource types'
      };
    }
  },

  // Get resources by facility
  async getResourcesByFacility(facilityId, params = {}) {
    try {
      const response = await api.get(`/api/resources/facility/${facilityId}`, { params });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch resources'
      };
    }
  },

  // Get single resource by ID
  async getResourceById(id) {
    try {
      const response = await api.get(`/api/resources/${id}`);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch resource'
      };
    }
  },

  // Create new resource
  async createResource(resourceData) {
    try {
      const response = await api.post('/api/resources', resourceData);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to create resource'
      };
    }
  },

  // Update resource
  async updateResource(id, resourceData) {
    try {
      const response = await api.put(`/api/resources/${id}`, resourceData);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to update resource'
      };
    }
  },

  // Toggle resource status
  async toggleResourceStatus(id, status) {
    try {
      const response = await api.patch(`/api/resources/${id}/status`, { status });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to update resource status'
      };
    }
  },

  // Delete resource
  async deleteResource(id) {
    try {
      const response = await api.delete(`/api/resources/${id}`);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to delete resource'
      };
    }
  }
};

export default resourceService;