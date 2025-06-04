// frontend/src/services/schedulerService.js
import api from './api';
import { dateUtils } from '../utils/dateUtils';

const schedulerService = {
  // Get user's programs
  async getUserPrograms() {
    try {
      const response = await api.get('/api/scheduler/programs');
      return { 
        success: true, 
        data: response.data 
      };
    } catch (error) {
      console.error('Get user programs error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch your programs'
      };
    }
  },

  // Get filtered episodes for scheduler view
  async getFilteredEpisodes(params = {}) {
    try {
      const response = await api.get('/api/scheduler/episodes', { 
        params,
        signal: params.signal
      });
      
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
          assignedProgram: event.extendedProps?.assignedProgram,
          canRequest: event.extendedProps?.canRequest || false
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
      
      console.error('Get filtered episodes error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch calendar events'
      };
    }
  },

  // Submit ice time requests (shopping cart)
  async submitIceTimeRequests(requestData) {
    try {
      console.log('Scheduler Service - Submitting requests:', requestData);
      
      // Validate required fields
      if (!requestData.program_id || !requestData.requests || requestData.requests.length === 0) {
        return { 
          success: false, 
          error: 'Missing required fields or empty requests' 
        };
      }
      
      const response = await api.post('/api/scheduler/requests', requestData);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Submit ice time requests error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to submit requests'
      };
    }
  },

  // Get request status for a program
  async getRequestStatus(programId, params = {}) {
    try {
      const response = await api.get(`/api/scheduler/programs/${programId}/requests`, { params });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Get request status error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch request status'
      };
    }
  },

  // Get booking history for a program
  async getBookingHistory(programId, params = {}) {
    try {
      const response = await api.get(`/api/scheduler/programs/${programId}/bookings`, { params });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Get booking history error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch booking history'
      };
    }
  },

  // Cancel a request (if still pending)
  async cancelRequest(requestId) {
    try {
      const response = await api.delete(`/api/scheduler/requests/${requestId}`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Cancel request error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to cancel request'
      };
    }
  },

  // Update request details (if editable)
  async updateRequest(requestId, updateData) {
    try {
      const response = await api.put(`/api/scheduler/requests/${requestId}`, updateData);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Update request error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to update request'
      };
    }
  },

  // Request specific ice time (single request, not from cart)
  async requestIceTime(requestData) {
    try {
      console.log('Scheduler Service - Requesting ice time:', requestData);
      
      // Validate required fields
      if (!requestData.program_id || !requestData.episode_id) {
        return { 
          success: false, 
          error: 'Missing required fields' 
        };
      }
      
      const response = await api.post('/api/scheduler/request-ice-time', requestData);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Request ice time error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to request ice time'
      };
    }
  },

  // Get program dashboard data
  async getProgramDashboard(programId) {
    try {
      const response = await api.get(`/api/scheduler/programs/${programId}/dashboard`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Get program dashboard error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch dashboard data'
      };
    }
  },

  // Get available facilities (that allow public requests)
  async getAvailableFacilities() {
    try {
      const response = await api.get('/api/scheduler/facilities');
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Get available facilities error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch available facilities'
      };
    }
  },

  // Check if episode can be requested
  async checkEpisodeAvailability(episodeId, programId) {
    try {
      const response = await api.get(`/api/scheduler/episodes/${episodeId}/availability`, {
        params: { program_id: programId }
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Check episode availability error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to check availability'
      };
    }
  },

  // Get program statistics
  async getProgramStats(programId, params = {}) {
    try {
      const response = await api.get(`/api/scheduler/programs/${programId}/stats`, { params });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Get program stats error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch program statistics'
      };
    }
  },

  // Validate multiple requests before submission
  async validateRequests(requestData) {
    try {
      const response = await api.post('/api/scheduler/validate-requests', requestData);
      return { 
        success: true, 
        data: {
          isValid: response.data.valid,
          conflicts: response.data.conflicts || [],
          warnings: response.data.warnings || [],
          totalCost: response.data.totalCost || 0
        }
      };
    } catch (error) {
      console.error('Validate requests error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to validate requests'
      };
    }
  },

  // Helper function to format request status
  getStatusDisplay(status) {
    const statusMap = {
      'pending': { label: 'Pending Review', color: '#f6ad55', icon: '⏳' },
      'approved': { label: 'Approved', color: '#48bb78', icon: '✅' },
      'rejected': { label: 'Rejected', color: '#fc8181', icon: '❌' },
      'cancelled': { label: 'Cancelled', color: '#a0aec0', icon: '🚫' },
      'confirmed': { label: 'Confirmed', color: '#4299e1', icon: '📅' },
      'expired': { label: 'Expired', color: '#9e9e9e', icon: '⌛' }
    };
    
    return statusMap[status] || { label: status, color: '#a0aec0', icon: '❓' };
  },

  // Helper function to calculate total cost
  calculateTotalCost(items) {
    return items.reduce((total, item) => total + (item.price || 0), 0);
  },

  // Helper function to group items by facility
  groupItemsByFacility(items) {
    const grouped = {};
    items.forEach(item => {
      const facilityKey = item.facilityId || item.facilityName || 'Unknown';
      if (!grouped[facilityKey]) {
        grouped[facilityKey] = {
          facilityName: item.facilityName || 'Unknown Facility',
          items: []
        };
      }
      grouped[facilityKey].items.push(item);
    });
    return grouped;
  },

  // Helper function to validate shopping cart
  validateShoppingCart(items, program) {
    const errors = [];
    const warnings = [];
    
    if (!items || items.length === 0) {
      errors.push('Shopping cart is empty');
      return { isValid: false, errors, warnings };
    }
    
    if (!program) {
      errors.push('No program selected');
      return { isValid: false, errors, warnings };
    }
    
    // Check for duplicate episodes
    const episodeIds = items.map(item => item.episodeId);
    const duplicates = episodeIds.filter((id, index) => episodeIds.indexOf(id) !== index);
    if (duplicates.length > 0) {
      errors.push('Duplicate ice time slots in cart');
    }
    
    // Check for time conflicts within cart
    const conflicts = this.findTimeConflicts(items);
    if (conflicts.length > 0) {
      errors.push('Time conflicts found in cart');
      warnings.push(...conflicts.map(c => `Conflict: ${c.item1.title} and ${c.item2.title}`));
    }
    
    // Check for past dates
    const pastItems = items.filter(item => new Date(item.startTime) < new Date());
    if (pastItems.length > 0) {
      errors.push('Cannot request ice time in the past');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  },

  // Helper function to find time conflicts
  findTimeConflicts(items) {
    const conflicts = [];
    
    for (let i = 0; i < items.length - 1; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const item1 = items[i];
        const item2 = items[j];
        
        // Check if they're on the same day and resource
        const date1 = dateUtils.extractDateString(item1.startTime);
        const date2 = dateUtils.extractDateString(item2.startTime);
        
        if (date1 === date2 && item1.resourceName === item2.resourceName) {
          // Check for time overlap
          const start1 = new Date(item1.startTime);
          const end1 = new Date(item1.endTime);
          const start2 = new Date(item2.startTime);
          const end2 = new Date(item2.endTime);
          
          if (start1 < end2 && start2 < end1) {
            conflicts.push({ item1, item2 });
          }
        }
      }
    }
    
    return conflicts;
  }
};

export default schedulerService;