// frontend/src/services/programService.js
import api from './api';

const programService = {
  // Get all programs
  async getPrograms(params = {}) {
    try {
      const response = await api.get('/api/programs', { params });
      return { 
        success: true, 
        data: response.data 
      };
    } catch (error) {
      console.error('Get programs error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch programs'
      };
    }
  },

  // Get single program
  async getProgramById(id) {
    try {
      const response = await api.get(`/api/programs/${id}`);
      return { 
        success: true, 
        data: response.data 
      };
    } catch (error) {
      console.error('Get program error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch program'
      };
    }
  },

  // Create program
  async createProgram(programData) {
    try {
      const response = await api.post('/api/programs', programData);
      return { 
        success: true, 
        data: response.data 
      };
    } catch (error) {
      console.error('Create program error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to create program'
      };
    }
  },

  // Update program
  async updateProgram(id, programData) {
    try {
      const response = await api.put(`/api/programs/${id}`, programData);
      return { 
        success: true, 
        data: response.data 
      };
    } catch (error) {
      console.error('Update program error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to update program'
      };
    }
  },

  // Delete program
  async deleteProgram(id) {
    try {
      const response = await api.delete(`/api/programs/${id}`);
      return { 
        success: true, 
        data: response.data 
      };
    } catch (error) {
      console.error('Delete program error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to delete program'
      };
    }
  },

  // Helper to format program for display
  formatProgramOption(program) {
    return {
      value: program.program_id,
      label: program.program_name,
      color: program.program_color,
      type: program.programType?.program_type_name || 'Unknown'
    };
  }
};

export default programService;