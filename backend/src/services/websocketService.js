// backend/src/services/websocketService.js
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { WebSocketSession, User, Facility, Program, RealtimeNotification } = require('../models');

class WebSocketService {
  constructor() {
    this.io = null;
    this.episodeLocks = new Map(); // episodeId -> { userId, username, lockTime, facilityId }
    this.userSessions = new Map(); // userId -> Set of socket ids
    this.LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    this.CLEANUP_INTERVAL = 60 * 1000; // 1 minute
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.startCleanupInterval();

    console.log('WebSocket service initialized');
  }

  setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          return next(new Error('No authentication token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findByPk(decoded.user_id);
        
        if (!user || !user.is_active) {
          return next(new Error('Invalid or inactive user'));
        }

        socket.userId = user.user_id;
        socket.user = user;
        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', async (socket) => {
      console.log(`User ${socket.user.username} connected (${socket.id})`);

      try {
        // Create WebSocket session record
        await this.createWebSocketSession(socket);
        
        // Add to user sessions tracking
        if (!this.userSessions.has(socket.userId)) {
          this.userSessions.set(socket.userId, new Set());
        }
        this.userSessions.get(socket.userId).add(socket.id);

        // Setup event handlers for this socket
        this.setupSocketHandlers(socket);

      } catch (error) {
        console.error('Socket connection setup error:', error);
        socket.disconnect();
      }
    });
  }

  setupSocketHandlers(socket) {
    // Join facility rooms
    socket.on('join_facility', async (facilityId) => {
      try {
        await this.joinFacility(socket, facilityId);
      } catch (error) {
        console.error('Join facility error:', error);
        socket.emit('error', { message: 'Failed to join facility' });
      }
    });

    // Leave facility rooms
    socket.on('leave_facility', async (facilityId) => {
      try {
        await this.leaveFacility(socket, facilityId);
      } catch (error) {
        console.error('Leave facility error:', error);
      }
    });

    // Episode locking
    socket.on('lock_episode', async (data) => {
      try {
        const result = await this.lockEpisode(socket, data.episodeId, data.facilityId);
        socket.emit('lock_episode_result', result);
      } catch (error) {
        console.error('Lock episode error:', error);
        socket.emit('lock_episode_result', { success: false, error: error.message });
      }
    });

    // Episode unlock
    socket.on('unlock_episode', async (data) => {
      try {
        await this.unlockEpisode(socket, data.episodeId);
        socket.emit('unlock_episode_result', { success: true });
      } catch (error) {
        console.error('Unlock episode error:', error);
        socket.emit('unlock_episode_result', { success: false, error: error.message });
      }
    });

    // Heartbeat for presence
    socket.on('heartbeat', async () => {
      try {
        await this.updateUserActivity(socket);
        socket.emit('heartbeat_ack');
      } catch (error) {
        console.error('Heartbeat error:', error);
      }
    });

    // Acknowledge notification
    socket.on('acknowledge_notification', async (notificationId) => {
      try {
        await this.acknowledgeNotification(socket, notificationId);
      } catch (error) {
        console.error('Acknowledge notification error:', error);
      }
    });

    // Disconnect handler
    socket.on('disconnect', async (reason) => {
      console.log(`User ${socket.user.username} disconnected: ${reason}`);
      await this.handleDisconnect(socket);
    });

    // Error handler
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  async createWebSocketSession(socket) {
    const session = await WebSocketSession.create({
      session_id: `ws_${socket.id}_${Date.now()}`,
      user_id: socket.userId,
      socket_id: socket.id,
      user_agent: socket.handshake.headers['user-agent'],
      ip_address: socket.handshake.address,
      connected_at: new Date(),
      last_activity: new Date()
    });

    socket.sessionId = session.session_id;
    return session;
  }

  async joinFacility(socket, facilityId) {
    // Verify user has access to facility
    const hasAccess = await this.verifyFacilityAccess(socket.userId, facilityId);
    if (!hasAccess) {
      throw new Error('Access denied to facility');
    }

    const roomName = `facility_${facilityId}`;
    await socket.join(roomName);

    // Update session with facility subscription
    await WebSocketSession.update(
      { 
        facility_ids: socket.facilityIds ? 
          [...new Set([...socket.facilityIds, parseInt(facilityId)])] : 
          [parseInt(facilityId)],
        last_activity: new Date()
      },
      { where: { socket_id: socket.id } }
    );

    socket.facilityIds = socket.facilityIds || [];
    if (!socket.facilityIds.includes(parseInt(facilityId))) {
      socket.facilityIds.push(parseInt(facilityId));
    }

    // Broadcast user joined to facility
    socket.to(roomName).emit('user_joined_facility', {
      userId: socket.userId,
      username: socket.user.username,
      userType: socket.user.user_type,
      facilityId: parseInt(facilityId)
    });

    // Send current facility status to joining user
    await this.sendFacilityStatus(socket, facilityId);

    console.log(`User ${socket.user.username} joined facility ${facilityId}`);
  }

  async leaveFacility(socket, facilityId) {
    const roomName = `facility_${facilityId}`;
    await socket.leave(roomName);

    // Update session
    if (socket.facilityIds) {
      socket.facilityIds = socket.facilityIds.filter(id => id !== parseInt(facilityId));
      
      await WebSocketSession.update(
        { 
          facility_ids: socket.facilityIds,
          last_activity: new Date()
        },
        { where: { socket_id: socket.id } }
      );
    }

    // Release any locks held by this user in this facility
    await this.releaseUserLocksInFacility(socket.userId, facilityId);

    // Broadcast user left
    socket.to(roomName).emit('user_left_facility', {
      userId: socket.userId,
      username: socket.user.username,
      facilityId: parseInt(facilityId)
    });

    console.log(`User ${socket.user.username} left facility ${facilityId}`);
  }

  async lockEpisode(socket, episodeId, facilityId) {
    const lockKey = episodeId.toString();
    const now = new Date();

    // Check if episode is already locked
    if (this.episodeLocks.has(lockKey)) {
      const lock = this.episodeLocks.get(lockKey);
      
      // Check if lock is expired
      if (now - lock.lockTime < this.LOCK_TIMEOUT) {
        if (lock.userId === socket.userId) {
          // User already has the lock, refresh it
          lock.lockTime = now;
          return { success: true, message: 'Lock refreshed' };
        } else {
          return { 
            success: false, 
            error: `Episode is being edited by ${lock.username}`,
            lockedBy: lock.username
          };
        }
      } else {
        // Lock expired, remove it
        this.episodeLocks.delete(lockKey);
      }
    }

    // Create new lock
    const lock = {
      userId: socket.userId,
      username: socket.user.username,
      lockTime: now,
      facilityId: parseInt(facilityId)
    };

    this.episodeLocks.set(lockKey, lock);

    // Broadcast lock to facility
    const roomName = `facility_${facilityId}`;
    socket.to(roomName).emit('episode_locked', {
      episodeId,
      lockedBy: {
        userId: socket.userId,
        username: socket.user.username
      },
      lockTime: now
    });

    return { success: true, message: 'Episode locked successfully' };
  }

  async unlockEpisode(socket, episodeId) {
    const lockKey = episodeId.toString();
    const lock = this.episodeLocks.get(lockKey);

    if (!lock) {
      return; // No lock to release
    }

    if (lock.userId !== socket.userId) {
      throw new Error('Cannot unlock episode locked by another user');
    }

    this.episodeLocks.delete(lockKey);

    // Broadcast unlock to facility
    if (lock.facilityId) {
      const roomName = `facility_${lock.facilityId}`;
      socket.to(roomName).emit('episode_unlocked', {
        episodeId,
        unlockedBy: {
          userId: socket.userId,
          username: socket.user.username
        }
      });
    }
  }

  async releaseUserLocksInFacility(userId, facilityId) {
    const locksToRelease = [];
    
    for (const [episodeId, lock] of this.episodeLocks.entries()) {
      if (lock.userId === userId && lock.facilityId === parseInt(facilityId)) {
        locksToRelease.push(episodeId);
      }
    }

    // Release locks and broadcast
    for (const episodeId of locksToRelease) {
      this.episodeLocks.delete(episodeId);
      
      const roomName = `facility_${facilityId}`;
      this.io.to(roomName).emit('episode_unlocked', {
        episodeId: parseInt(episodeId),
        unlockedBy: { userId, reason: 'User disconnected' }
      });
    }
  }

  async sendFacilityStatus(socket, facilityId) {
    // Send current locks for this facility
    const facilityLocks = [];
    for (const [episodeId, lock] of this.episodeLocks.entries()) {
      if (lock.facilityId === parseInt(facilityId)) {
        facilityLocks.push({
          episodeId: parseInt(episodeId),
          lockedBy: {
            userId: lock.userId,
            username: lock.username
          },
          lockTime: lock.lockTime
        });
      }
    }

    // Send active users in facility
    const roomName = `facility_${facilityId}`;
    const room = this.io.sockets.adapter.rooms.get(roomName);
    const activeUsers = [];
    
    if (room) {
      for (const socketId of room) {
        const clientSocket = this.io.sockets.sockets.get(socketId);
        if (clientSocket && clientSocket.user) {
          activeUsers.push({
            userId: clientSocket.userId,
            username: clientSocket.user.username,
            userType: clientSocket.user.user_type
          });
        }
      }
    }

    socket.emit('facility_status', {
      facilityId: parseInt(facilityId),
      locks: facilityLocks,
      activeUsers: activeUsers.filter(user => user.userId !== socket.userId) // Exclude self
    });
  }

  async updateUserActivity(socket) {
    await WebSocketSession.update(
      { last_activity: new Date() },
      { where: { socket_id: socket.id } }
    );
  }

  async acknowledgeNotification(socket, notificationId) {
    await RealtimeNotification.update(
      { is_delivered: true, sent_at: new Date() },
      { where: { notification_id: notificationId } }
    );
  }

  async handleDisconnect(socket) {
    try {
      // Release all locks held by this user
      const locksToRelease = [];
      for (const [episodeId, lock] of this.episodeLocks.entries()) {
        if (lock.userId === socket.userId) {
          locksToRelease.push({ episodeId, facilityId: lock.facilityId });
        }
      }

      for (const { episodeId, facilityId } of locksToRelease) {
        this.episodeLocks.delete(episodeId);
        
        const roomName = `facility_${facilityId}`;
        this.io.to(roomName).emit('episode_unlocked', {
          episodeId: parseInt(episodeId),
          unlockedBy: { 
            userId: socket.userId, 
            username: socket.user.username,
            reason: 'User disconnected' 
          }
        });
      }

      // Broadcast user left to all facilities
      if (socket.facilityIds) {
        for (const facilityId of socket.facilityIds) {
          const roomName = `facility_${facilityId}`;
          socket.to(roomName).emit('user_left_facility', {
            userId: socket.userId,
            username: socket.user.username,
            facilityId
          });
        }
      }

      // Remove from user sessions tracking
      if (this.userSessions.has(socket.userId)) {
        this.userSessions.get(socket.userId).delete(socket.id);
        if (this.userSessions.get(socket.userId).size === 0) {
          this.userSessions.delete(socket.userId);
        }
      }

      // Update session record
      await WebSocketSession.destroy({
        where: { socket_id: socket.id }
      });

    } catch (error) {
      console.error('Disconnect cleanup error:', error);
    }
  }

  async verifyFacilityAccess(userId, facilityId) {
    const user = await User.findByPk(userId);
    if (!user) return false;

    // Admins can access facilities they manage
    if (user.user_type === 'admin') {
      const facility = await Facility.findOne({
        where: { 
          facility_id: facilityId,
          admin_user_id: userId
        }
      });
      return !!facility;
    }

    // Schedulers can access facilities where they have programs
    if (user.user_type === 'scheduler') {
      const programs = await Program.findAll({
        where: { scheduler_user_id: userId }
      });
      // For now, allow access to all facilities if they have any programs
      return programs.length > 0;
    }

    return false;
  }

  startCleanupInterval() {
    setInterval(() => {
      this.cleanupExpiredLocks();
      this.cleanupInactiveSessions();
    }, this.CLEANUP_INTERVAL);
  }

  cleanupExpiredLocks() {
    const now = new Date();
    const expiredLocks = [];

    for (const [episodeId, lock] of this.episodeLocks.entries()) {
      if (now - lock.lockTime > this.LOCK_TIMEOUT) {
        expiredLocks.push({ episodeId, lock });
      }
    }

    for (const { episodeId, lock } of expiredLocks) {
      this.episodeLocks.delete(episodeId);
      
      // Broadcast lock expiration
      const roomName = `facility_${lock.facilityId}`;
      this.io.to(roomName).emit('episode_unlocked', {
        episodeId: parseInt(episodeId),
        unlockedBy: { reason: 'Lock expired' }
      });
    }

    if (expiredLocks.length > 0) {
      console.log(`Cleaned up ${expiredLocks.length} expired locks`);
    }
  }

  async cleanupInactiveSessions() {
    try {
      const deleted = await WebSocketSession.cleanupInactive(1); // 1 hour old
      if (deleted > 0) {
        console.log(`Cleaned up ${deleted} inactive WebSocket sessions`);
      }
    } catch (error) {
      console.error('Session cleanup error:', error);
    }
  }

  // Broadcast methods for calendar updates
  async broadcastEpisodeCreated(facilityId, episodeData) {
    const roomName = `facility_${facilityId}`;
    this.io.to(roomName).emit('episode_created', {
      type: 'episode_created',
      data: episodeData,
      timestamp: new Date()
    });
  }

  async broadcastEpisodeUpdated(facilityId, episodeId, updates) {
    const roomName = `facility_${facilityId}`;
    this.io.to(roomName).emit('episode_updated', {
      type: 'episode_updated',
      episodeId,
      updates,
      timestamp: new Date()
    });
  }

  async broadcastEpisodeDeleted(facilityId, episodeId) {
    const roomName = `facility_${facilityId}`;
    this.io.to(roomName).emit('episode_deleted', {
      type: 'episode_deleted',
      episodeId,
      timestamp: new Date()
    });
  }

  async broadcastEpisodeMoved(facilityId, episodeId, newStartTime, newEndTime) {
    const roomName = `facility_${facilityId}`;
    this.io.to(roomName).emit('episode_moved', {
      type: 'episode_moved',
      episodeId,
      newStartTime,
      newEndTime,
      timestamp: new Date()
    });
  }

  async sendNotificationToUser(userId, notification) {
    const userSockets = this.userSessions.get(userId);
    if (userSockets) {
      for (const socketId of userSockets) {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('notification', notification);
        }
      }
    }
  }

  getActiveUsersInFacility(facilityId) {
    const roomName = `facility_${facilityId}`;
    const room = this.io.sockets.adapter.rooms.get(roomName);
    const users = [];
    
    if (room) {
      for (const socketId of room) {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket && socket.user) {
          users.push({
            userId: socket.userId,
            username: socket.user.username,
            userType: socket.user.user_type
          });
        }
      }
    }
    
    return users;
  }

  isEpisodeLocked(episodeId) {
    const lock = this.episodeLocks.get(episodeId.toString());
    if (!lock) return null;
    
    const now = new Date();
    if (now - lock.lockTime > this.LOCK_TIMEOUT) {
      this.episodeLocks.delete(episodeId.toString());
      return null;
    }
    
    return lock;
  }
}

// Singleton instance
const websocketService = new WebSocketService();

module.exports = websocketService;