import api from './api';

const authService = {
  login: async (username, password) => {
    try {
      console.log('Sending login request to:', '/api/auth/login');
      const response = await api.post('/api/auth/login', {
        username,
        password
      });
      
      console.log('Login response:', response.data);
      
      const { token, user } = response.data;
      
      // Store token and user info
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      console.log('Token stored:', !!token);
      console.log('User stored:', user);
      
      return { success: true, user };
    } catch (error) {
      console.error('Login error:', error.response || error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Login failed' 
      };
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Optionally call logout endpoint
    api.post('/api/auth/logout').catch(() => {});
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },

  getProfile: async () => {
    try {
      const response = await api.get('/api/auth/profile');
      return { success: true, user: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || 'Failed to fetch profile' 
      };
    }
  }
};

export default authService;