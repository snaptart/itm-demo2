// frontend/src/services/websocketService.js
import { io } from 'socket.io-client';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.eventListeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.connectionStatus = { connected: false, error: null };
    this.activeUsers = [];
    this.facilityLocks = new Map();
    this.notificationQueue = [];
    this.heartbeatInterval = null;
  }

  // Connect to WebSocket server
  connect(token = null) {
    if (this.socket && this.isConnected) {
      console.log('WebSocket already connected');
      return;
    }

    // Get token from localStorage if not provided
    const authToken = token || localStorage.getItem('token');
    if (!authToken) {
      console.error('No authentication token available for WebSocket connection');
      return;
    }

    const serverUrl = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:3001';
    
    console.log('Connecting to WebSocket server:', serverUrl);

    this.socket = io(serverUrl, {
      auth: {
        token: authToken
      },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay
    });

    this.setupEventHandlers();
  }

  // Setup event handlers for the socket
  setupEventHandlers() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('WebSocket connected:', this.socket.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.connectionStatus = { connected: true, error: null };
      this.notifyListeners('connection_status', this.connectionStatus);
      
      // Start heartbeat
      this.startHeartbeat();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.isConnected = false;
      this.connectionStatus = { connected: false, error: reason };
      this.notifyListeners('connection_status', this.connectionStatus);
      
      // Clear heartbeat
      this.stopHeartbeat();
      
      // Clear active users
      this.activeUsers = [];
      this.notifyListeners('active_users_changed', this.activeUsers);
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.connectionStatus = { connected: false, error: error.message };
      this.notifyListeners('connection_status', this.connectionStatus);
    });

    // Facility events
    this.socket.on('user_joined_facility', (data) => {
      console.log('User joined facility:', data);
      this.addActiveUser(data);
      this.notifyListeners('user_joined', data);
    });

    this.socket.on('user_left_facility', (data) => {
      console.log('User left facility:', data);
      this.removeActiveUser(data.userId);
      this.notifyListeners('user_left', data);
    });

    this.socket.on('facility_status', (data) => {
      console.log('Facility status received:', data);
      this.activeUsers = data.activeUsers || [];
      this.facilityLocks.clear();
      (data.locks || []).forEach(lock => {
        this.facilityLocks.set(lock.episodeId, lock);
      });
      this.notifyListeners('facility_status', data);
    });

    // Episode events
    this.socket.on('episode_created', (data) => {
      console.log('Episode created via WebSocket:', data);
      this.notifyListeners('episode_created', data);
    });

    this.socket.on('episode_updated', (data) => {
      console.log('Episode updated via WebSocket:', data);
      this.notifyListeners('episode_updated', data);
    });

    this.socket.on('episode_deleted', (data) => {
      console.log('Episode deleted via WebSocket:', data);
      this.notifyListeners('episode_deleted', data);
    });

    this.socket.on('episode_moved', (data) => {
      console.log('Episode moved via WebSocket:', data);
      this.notifyListeners('episode_moved', data);
    });

    // Episode locking events
    this.socket.on('episode_locked', (data) => {
      console.log('Episode locked:', data);
      this.facilityLocks.set(data.episodeId, data);
      this.notifyListeners('episode_locked', data);
    });

    this.socket.on('episode_unlocked', (data) => {
      console.log('Episode unlocked:', data);
      this.facilityLocks.delete(data.episodeId);
      this.notifyListeners('episode_unlocked', data);
    });

    // Lock operation responses
    this.socket.on('lock_episode_result', (data) => {
      console.log('Lock episode result:', data);
      this.notifyListeners('lock_episode_result', data);
    });

    this.socket.on('unlock_episode_result', (data) => {
      console.log('Unlock episode result:', data);
      this.notifyListeners('unlock_episode_result', data);
    });

    // Notifications
    this.socket.on('notification', (notification) => {
      console.log('Notification received:', notification);
      this.handleNotification(notification);
    });

    // Heartbeat
    this.socket.on('heartbeat_ack', () => {
      // Heartbeat acknowledged
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.notifyListeners('error', error);
    });
  }

  // Start heartbeat to maintain connection
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.isConnected) {
        this.socket.emit('heartbeat');
      }
    }, 30000); // Every 30 seconds
  }

  // Stop heartbeat
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Disconnect from WebSocket server
  disconnect() {
    if (this.socket) {
      this.stopHeartbeat();
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.connectionStatus = { connected: false, error: null };
      this.activeUsers = [];
      this.facilityLocks.clear();
    }
  }

  // Join a facility room
  joinFacility(facilityId) {
    if (this.socket && this.isConnected) {
      console.log('Joining facility:', facilityId);
      this.socket.emit('join_facility', facilityId);
    } else {
      console.warn('Cannot join facility - WebSocket not connected');
    }
  }

  // Leave a facility room
  leaveFacility(facilityId) {
    if (this.socket && this.isConnected) {
      console.log('Leaving facility:', facilityId);
      this.socket.emit('leave_facility', facilityId);
    }
  }

  // Lock an episode for editing
  async lockEpisode(episodeId, facilityId) {
    return new Promise((resolve) => {
      if (!this.socket || !this.isConnected) {
        resolve({ success: false, error: 'Not connected to server' });
        return;
      }

      // Listen for the response
      const responseHandler = (data) => {
        this.socket.off('lock_episode_result', responseHandler);
        resolve(data);
      };

      this.socket.on('lock_episode_result', responseHandler);

      // Send lock request
      this.socket.emit('lock_episode', { episodeId, facilityId });

      // Timeout after 5 seconds
      setTimeout(() => {
        this.socket.off('lock_episode_result', responseHandler);
        resolve({ success: false, error: 'Lock request timeout' });
      }, 5000);
    });
  }

  // Unlock an episode
  async unlockEpisode(episodeId) {
    return new Promise((resolve) => {
      if (!this.socket || !this.isConnected) {
        resolve({ success: false, error: 'Not connected to server' });
        return;
      }

      // Listen for the response
      const responseHandler = (data) => {
        this.socket.off('unlock_episode_result', responseHandler);
        resolve(data);
      };

      this.socket.on('unlock_episode_result', responseHandler);

      // Send unlock request
      this.socket.emit('unlock_episode', { episodeId });

      // Timeout after 5 seconds
      setTimeout(() => {
        this.socket.off('unlock_episode_result', responseHandler);
        resolve({ success: false, error: 'Unlock request timeout' });
      }, 5000);
    });
  }

  // Check if an episode is locked
  isEpisodeLocked(episodeId) {
    const lock = this.facilityLocks.get(parseInt(episodeId));
    if (!lock) return null;

    // Check if lock is expired (older than 5 minutes)
    const lockTime = new Date(lock.lockTime);
    const now = new Date();
    const timeDiff = now - lockTime;
    
    if (timeDiff > 5 * 60 * 1000) { // 5 minutes
      this.facilityLocks.delete(parseInt(episodeId));
      return null;
    }

    return lock;
  }

  // Add event listener
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(callback);
  }

  // Remove event listener
  off(event, callback) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).delete(callback);
    }
  }

  // Notify all listeners for an event
  notifyListeners(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  // Handle incoming notifications
  handleNotification(notification) {
    // Add to queue
    this.notificationQueue.unshift({
      ...notification,
      id: notification.notification_id || Date.now(),
      timestamp: new Date(),
      read: false
    });

    // Keep only last 50 notifications
    if (this.notificationQueue.length > 50) {
      this.notificationQueue = this.notificationQueue.slice(0, 50);
    }

    // Notify listeners
    this.notifyListeners('notification', notification);

    // Acknowledge receipt
    if (notification.notification_id) {
      this.socket.emit('acknowledge_notification', notification.notification_id);
    }
  }

  // Manage active users
  addActiveUser(user) {
    // Remove existing entry for this user
    this.activeUsers = this.activeUsers.filter(u => u.userId !== user.userId);
    // Add updated entry
    this.activeUsers.push(user);
    this.notifyListeners('active_users_changed', this.activeUsers);
  }

  removeActiveUser(userId) {
    this.activeUsers = this.activeUsers.filter(u => u.userId !== userId);
    this.notifyListeners('active_users_changed', this.activeUsers);
  }

  // Getters
  getConnectionStatus() {
    return this.connectionStatus;
  }

  getActiveUsers() {
    return this.activeUsers;
  }

  getNotificationQueue() {
    return [...this.notificationQueue];
  }

  clearNotificationQueue() {
    this.notificationQueue = [];
  }

  // Check if currently connected
  get connected() {
    return this.isConnected && this.socket?.connected;
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

export default websocketService;