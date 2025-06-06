// frontend/src/services/websocketService.js
import { io } from 'socket.io-client';
import authService from './authService';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.eventListeners = new Map();
    this.facilityId = null;
    this.activeLocks = new Set();
    this.activeUsers = new Map();
    this.heartbeatInterval = null;
    this.notificationQueue = [];
  }

  // Initialize WebSocket connection
  connect() {
    const token = authService.getToken();
    if (!token) {
      console.error('No authentication token available');
      return;
    }

    const serverUrl = process.env.REACT_APP_WS_URL || 
                     process.env.REACT_APP_API_URL?.replace(/^http/, 'ws') || 
                     'ws://localhost:3001';

    console.log('Connecting to WebSocket server:', serverUrl);

    this.socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay
    });

    this.setupEventHandlers();
  }

  // Setup WebSocket event handlers
  setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('Connected to WebSocket server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.emit('connection_status', { connected: true });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from WebSocket server:', reason);
      this.isConnected = false;
      this.stopHeartbeat();
      this.emit('connection_status', { connected: false, reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;
      this.emit('connection_error', { error, attempts: this.reconnectAttempts });
    });

    // Real-time episode updates
    this.socket.on('episode_created', (data) => {
      console.log('Episode created:', data);
      this.emit('episode_created', data);
    });

    this.socket.on('episode_updated', (data) => {
      console.log('Episode updated:', data);
      this.emit('episode_updated', data);
    });

    this.socket.on('episode_deleted', (data) => {
      console.log('Episode deleted:', data);
      this.emit('episode_deleted', data);
    });

    this.socket.on('episode_moved', (data) => {
      console.log('Episode moved:', data);
      this.emit('episode_moved', data);
    });

    // Lock management
    this.socket.on('episode_locked', (data) => {
      console.log('Episode locked:', data);
      this.activeLocks.add(data.episodeId);
      this.emit('episode_locked', data);
    });

    this.socket.on('episode_unlocked', (data) => {
      console.log('Episode unlocked:', data);
      this.activeLocks.delete(data.episodeId);
      this.emit('episode_unlocked', data);
    });

    this.socket.on('lock_episode_result', (result) => {
      this.emit('lock_result', result);
    });

    this.socket.on('unlock_episode_result', (result) => {
      this.emit('unlock_result', result);
    });

    // User presence
    this.socket.on('user_joined_facility', (data) => {
      console.log('User joined facility:', data);
      this.activeUsers.set(data.userId, data);
      this.emit('user_joined', data);
    });

    this.socket.on('user_left_facility', (data) => {
      console.log('User left facility:', data);
      this.activeUsers.delete(data.userId);
      this.emit('user_left', data);
    });

    this.socket.on('facility_status', (data) => {
      console.log('Facility status:', data);
      
      // Update active locks
      this.activeLocks.clear();
      data.locks.forEach(lock => this.activeLocks.add(lock.episodeId));
      
      // Update active users
      this.activeUsers.clear();
      data.activeUsers.forEach(user => this.activeUsers.set(user.userId, user));
      
      this.emit('facility_status', data);
    });

    // Notifications
    this.socket.on('notification', (notification) => {
      console.log('Received notification:', notification);
      this.handleNotification(notification);
    });

    // Heartbeat
    this.socket.on('heartbeat_ack', () => {
      // Heartbeat acknowledged
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    });
  }

  // Join a facility room
  joinFacility(facilityId) {
    if (!this.isConnected) {
      console.warn('Cannot join facility - not connected to WebSocket');
      return;
    }

    console.log('Joining facility:', facilityId);
    this.facilityId = facilityId;
    this.socket.emit('join_facility', facilityId);
  }

  // Leave a facility room
  leaveFacility(facilityId) {
    if (!this.isConnected) return;

    console.log('Leaving facility:', facilityId);
    this.socket.emit('leave_facility', facilityId);
    
    if (this.facilityId === facilityId) {
      this.facilityId = null;
      this.activeLocks.clear();
      this.activeUsers.clear();
    }
  }

  // Lock an episode for editing
  async lockEpisode(episodeId, facilityId) {
    return new Promise((resolve) => {
      if (!this.isConnected) {
        resolve({ success: false, error: 'Not connected to server' });
        return;
      }

      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Lock request timeout' });
      }, 5000);

      const handleResult = (result) => {
        clearTimeout(timeout);
        this.off('lock_result', handleResult);
        resolve(result);
      };

      this.on('lock_result', handleResult);
      this.socket.emit('lock_episode', { episodeId, facilityId });
    });
  }

  // Unlock an episode
  async unlockEpisode(episodeId) {
    return new Promise((resolve) => {
      if (!this.isConnected) {
        resolve({ success: false, error: 'Not connected to server' });
        return;
      }

      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Unlock request timeout' });
      }, 5000);

      const handleResult = (result) => {
        clearTimeout(timeout);
        this.off('unlock_result', handleResult);
        resolve(result);
      };

      this.on('unlock_result', handleResult);
      this.socket.emit('unlock_episode', { episodeId });
    });
  }

  // Check if episode is locked
  isEpisodeLocked(episodeId) {
    return this.activeLocks.has(episodeId);
  }

  // Get active users in current facility
  getActiveUsers() {
    return Array.from(this.activeUsers.values());
  }

  // Handle incoming notifications
  handleNotification(notification) {
    // Add to queue for processing
    this.notificationQueue.push({
      ...notification,
      receivedAt: new Date()
    });

    // Emit to listeners
    this.emit('notification', notification);

    // Auto-acknowledge if configured
    if (notification.notification_id) {
      this.acknowledgeNotification(notification.notification_id);
    }
  }

  // Acknowledge a notification
  acknowledgeNotification(notificationId) {
    if (this.isConnected) {
      this.socket.emit('acknowledge_notification', notificationId);
    }
  }

  // Start heartbeat to maintain connection
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.socket.emit('heartbeat');
      }
    }, 30000); // 30 seconds
  }

  // Stop heartbeat
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Event listener management
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Event listener error:', error);
        }
      });
    }
  }

  // Disconnect and cleanup
  disconnect() {
    console.log('Disconnecting WebSocket');
    
    this.stopHeartbeat();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isConnected = false;
    this.facilityId = null;
    this.activeLocks.clear();
    this.activeUsers.clear();
    this.eventListeners.clear();
    this.notificationQueue = [];
  }

  // Get connection status
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      facilityId: this.facilityId,
      activeUsers: this.getActiveUsers().length,
      activeLocks: this.activeLocks.size
    };
  }

  // Get notification queue
  getNotificationQueue() {
    return [...this.notificationQueue];
  }

  // Clear notification queue
  clearNotificationQueue() {
    this.notificationQueue = [];
  }

  // Reconnect manually
  reconnect() {
    if (this.socket) {
      this.socket.connect();
    } else {
      this.connect();
    }
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

export default websocketService;