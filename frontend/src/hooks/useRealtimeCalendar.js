// frontend/src/hooks/useRealtimeCalendar.js
import { useEffect, useCallback, useRef } from 'react';
import websocketService from '../services/websocketService';

export const useRealtimeCalendar = (facilityId, onEventUpdate) => {
  const lockTimeoutRef = useRef(null);
  const currentLocks = useRef(new Set());

  // Handle episode updates from WebSocket
  const handleEpisodeCreated = useCallback((data) => {
    console.log('Real-time episode created:', data);
    if (onEventUpdate && data.data) {
      onEventUpdate({
        type: 'add',
        events: Array.isArray(data.data) ? data.data : [data.data]
      });
    }
  }, [onEventUpdate]);

  const handleEpisodeUpdated = useCallback((data) => {
    console.log('Real-time episode updated:', data);
    if (onEventUpdate) {
      onEventUpdate({
        type: 'update',
        episodeId: data.episodeId,
        updates: data.updates
      });
    }
  }, [onEventUpdate]);

  const handleEpisodeDeleted = useCallback((data) => {
    console.log('Real-time episode deleted:', data);
    if (onEventUpdate) {
      onEventUpdate({
        type: 'remove',
        episodeId: data.episodeId
      });
    }
  }, [onEventUpdate]);

  const handleEpisodeMoved = useCallback((data) => {
    console.log('Real-time episode moved:', data);
    if (onEventUpdate) {
      onEventUpdate({
        type: 'move',
        episodeId: data.episodeId,
        newStart: new Date(data.newStartTime),
        newEnd: new Date(data.newEndTime)
      });
    }
  }, [onEventUpdate]);

  const handleEpisodeLocked = useCallback((data) => {
    console.log('Episode locked:', data);
    currentLocks.current.add(data.episodeId);
    if (onEventUpdate) {
      onEventUpdate({
        type: 'lock',
        episodeId: data.episodeId,
        lockedBy: data.lockedBy
      });
    }
  }, [onEventUpdate]);

  const handleEpisodeUnlocked = useCallback((data) => {
    console.log('Episode unlocked:', data);
    currentLocks.current.delete(data.episodeId);
    if (onEventUpdate) {
      onEventUpdate({
        type: 'unlock',
        episodeId: data.episodeId,
        unlockedBy: data.unlockedBy
      });
    }
  }, [onEventUpdate]);

  // Setup WebSocket listeners
  useEffect(() => {
    if (!facilityId) return;

    // Connect to WebSocket if not already connected
    if (!websocketService.isConnected) {
      websocketService.connect();
    }

    // Join facility room
    websocketService.joinFacility(facilityId);

    // Setup event listeners
    websocketService.on('episode_created', handleEpisodeCreated);
    websocketService.on('episode_updated', handleEpisodeUpdated);
    websocketService.on('episode_deleted', handleEpisodeDeleted);
    websocketService.on('episode_moved', handleEpisodeMoved);
    websocketService.on('episode_locked', handleEpisodeLocked);
    websocketService.on('episode_unlocked', handleEpisodeUnlocked);

    return () => {
      // Cleanup listeners
      websocketService.off('episode_created', handleEpisodeCreated);
      websocketService.off('episode_updated', handleEpisodeUpdated);
      websocketService.off('episode_deleted', handleEpisodeDeleted);
      websocketService.off('episode_moved', handleEpisodeMoved);
      websocketService.off('episode_locked', handleEpisodeLocked);
      websocketService.off('episode_unlocked', handleEpisodeUnlocked);

      // Leave facility room
      websocketService.leaveFacility(facilityId);
    };
  }, [facilityId, handleEpisodeCreated, handleEpisodeUpdated, handleEpisodeDeleted, 
      handleEpisodeMoved, handleEpisodeLocked, handleEpisodeUnlocked]);

  // Lock episode for editing
  const lockEpisode = useCallback(async (episodeId) => {
    if (!facilityId) return { success: false, error: 'No facility selected' };
    
    const result = await websocketService.lockEpisode(episodeId, facilityId);
    
    if (result.success) {
      currentLocks.current.add(episodeId);
      
      // Auto-unlock after 4 minutes (before 5-minute timeout)
      if (lockTimeoutRef.current) {
        clearTimeout(lockTimeoutRef.current);
      }
      
      lockTimeoutRef.current = setTimeout(() => {
        unlockEpisode(episodeId);
      }, 4 * 60 * 1000);
    }
    
    return result;
  }, [facilityId]);

  // Unlock episode
  const unlockEpisode = useCallback(async (episodeId) => {
    const result = await websocketService.unlockEpisode(episodeId);
    
    if (result.success) {
      currentLocks.current.delete(episodeId);
      
      if (lockTimeoutRef.current) {
        clearTimeout(lockTimeoutRef.current);
        lockTimeoutRef.current = null;
      }
    }
    
    return result;
  }, []);

  // Check if episode is locked
  const isEpisodeLocked = useCallback((episodeId) => {
    return websocketService.isEpisodeLocked(episodeId);
  }, []);

  // Get current user's locks
  const getCurrentLocks = useCallback(() => {
    return Array.from(currentLocks.current);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (lockTimeoutRef.current) {
        clearTimeout(lockTimeoutRef.current);
      }
      
      // Unlock all current locks
      for (const episodeId of currentLocks.current) {
        websocketService.unlockEpisode(episodeId);
      }
    };
  }, []);

  return {
    lockEpisode,
    unlockEpisode,
    isEpisodeLocked,
    getCurrentLocks,
    activeUsers: websocketService.getActiveUsers(),
    connectionStatus: websocketService.getConnectionStatus()
  };
};

// Hook for user presence
export const useUserPresence = (facilityId) => {
  const [activeUsers, setActiveUsers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState({ connected: false });

  const handleUserJoined = useCallback((user) => {
    setActiveUsers(prev => {
      const filtered = prev.filter(u => u.userId !== user.userId);
      return [...filtered, user];
    });
  }, []);

  const handleUserLeft = useCallback((user) => {
    setActiveUsers(prev => prev.filter(u => u.userId !== user.userId));
  }, []);

  const handleFacilityStatus = useCallback((status) => {
    setActiveUsers(status.activeUsers || []);
  }, []);

  const handleConnectionStatus = useCallback((status) => {
    setConnectionStatus(status);
    if (!status.connected) {
      setActiveUsers([]);
    }
  }, []);

  useEffect(() => {
    if (!facilityId) return;

    websocketService.on('user_joined', handleUserJoined);
    websocketService.on('user_left', handleUserLeft);
    websocketService.on('facility_status', handleFacilityStatus);
    websocketService.on('connection_status', handleConnectionStatus);

    // Initial status
    setConnectionStatus(websocketService.getConnectionStatus());
    setActiveUsers(websocketService.getActiveUsers());

    return () => {
      websocketService.off('user_joined', handleUserJoined);
      websocketService.off('user_left', handleUserLeft);
      websocketService.off('facility_status', handleFacilityStatus);
      websocketService.off('connection_status', handleConnectionStatus);
    };
  }, [facilityId, handleUserJoined, handleUserLeft, handleFacilityStatus, handleConnectionStatus]);

  return {
    activeUsers,
    connectionStatus,
    totalUsers: activeUsers.length
  };
};

// Hook for real-time notifications
export const useRealtimeNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleNotification = useCallback((notification) => {
    const newNotification = {
      ...notification,
      id: notification.notification_id || Date.now(),
      timestamp: new Date(),
      read: false
    };

    setNotifications(prev => [newNotification, ...prev.slice(0, 49)]); // Keep max 50
    setUnreadCount(prev => prev + 1);
  }, []);

  const markAsRead = useCallback((notificationId) => {
    setNotifications(prev => prev.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const removeNotification = useCallback((notificationId) => {
    setNotifications(prev => {
      const notification = prev.find(n => n.id === notificationId);
      const filtered = prev.filter(n => n.id !== notificationId);
      
      if (notification && !notification.read) {
        setUnreadCount(count => Math.max(0, count - 1));
      }
      
      return filtered;
    });
  }, []);

  useEffect(() => {
    websocketService.on('notification', handleNotification);

    // Load any queued notifications
    const queuedNotifications = websocketService.getNotificationQueue();
    if (queuedNotifications.length > 0) {
      queuedNotifications.forEach(handleNotification);
      websocketService.clearNotificationQueue();
    }

    return () => {
      websocketService.off('notification', handleNotification);
    };
  }, [handleNotification]);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification
  };
};