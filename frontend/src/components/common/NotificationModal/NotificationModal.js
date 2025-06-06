// frontend/src/components/common/NotificationModal/NotificationModal.jsx
import React, { useState, useEffect } from 'react';
import './NotificationModal.css';

function NotificationModal({ 
  notification, 
  isOpen, 
  onClose, 
  onAcknowledge,
  autoCloseDelay = 5000 
}) {
  const [timeLeft, setTimeLeft] = useState(autoCloseDelay / 1000);
  const [isClosing, setIsClosing] = useState(false);

  // Auto-close timer
  useEffect(() => {
    if (!isOpen || !autoCloseDelay) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleAutoClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, autoCloseDelay]);

  // Reset timer when notification changes
  useEffect(() => {
    if (isOpen) {
      setTimeLeft(autoCloseDelay / 1000);
      setIsClosing(false);
    }
  }, [notification, isOpen, autoCloseDelay]);

  const handleAutoClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleAcknowledge = () => {
    if (onAcknowledge) {
      onAcknowledge(notification);
    }
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleDismiss = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const getNotificationIcon = (type) => {
    const iconMap = {
      'episode_created': '📅',
      'episode_updated': '✏️',
      'episode_deleted': '🗑️',
      'episode_moved': '↔️',
      'request_new': '📝',
      'request_approved': '✅',
      'request_rejected': '❌',
      'user_joined': '👋',
      'user_left': '👋',
      'error': '⚠️',
      'warning': '⚠️',
      'info': 'ℹ️',
      'success': '✅'
    };

    return iconMap[type] || 'ℹ️';
  };

  const getNotificationClass = (type) => {
    if (type?.includes('request_approved') || type?.includes('success')) {
      return 'notification-success';
    }
    if (type?.includes('request_rejected') || type?.includes('error')) {
      return 'notification-error';
    }
    if (type?.includes('warning')) {
      return 'notification-warning';
    }
    return 'notification-info';
  };

  const formatTimeLeft = (seconds) => {
    return `Auto-close in ${seconds}s`;
  };

  if (!isOpen || !notification) return null;

  return (
    <div className={`notification-overlay ${isClosing ? 'closing' : ''}`}>
      <div className={`notification-modal ${getNotificationClass(notification.event_type)} ${isClosing ? 'slide-out' : 'slide-in'}`}>
        <div className="notification-header">
          <div className="notification-icon">
            {getNotificationIcon(notification.event_type)}
          </div>
          <div className="notification-title-area">
            <h3 className="notification-title">
              {notification.title || 'Notification'}
            </h3>
            {autoCloseDelay > 0 && timeLeft > 0 && (
              <div className="auto-close-timer">
                {formatTimeLeft(timeLeft)}
              </div>
            )}
          </div>
          <button 
            className="notification-close" 
            onClick={handleDismiss}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>

        <div className="notification-body">
          <p className="notification-message">
            {notification.message || 'You have a new notification'}
          </p>

          {notification.event_data && (
            <div className="notification-details">
              {notification.event_data.episode_id && (
                <div className="detail-item">
                  <span className="detail-label">Ice Time:</span>
                  <span className="detail-value">#{notification.event_data.episode_id}</span>
                </div>
              )}
              
              {notification.event_data.request_number && (
                <div className="detail-item">
                  <span className="detail-label">Request:</span>
                  <span className="detail-value">{notification.event_data.request_number}</span>
                </div>
              )}

              {notification.event_data.program_name && (
                <div className="detail-item">
                  <span className="detail-label">Program:</span>
                  <span className="detail-value">{notification.event_data.program_name}</span>
                </div>
              )}

              {notification.event_data.user_name && (
                <div className="detail-item">
                  <span className="detail-label">User:</span>
                  <span className="detail-value">{notification.event_data.user_name}</span>
                </div>
              )}
            </div>
          )}

          {notification.created_at && (
            <div className="notification-timestamp">
              {new Date(notification.created_at).toLocaleString()}
            </div>
          )}
        </div>

        <div className="notification-footer">
          <button 
            className="btn btn-secondary" 
            onClick={handleDismiss}
          >
            Dismiss
          </button>
          
          {onAcknowledge && (
            <button 
              className="btn btn-primary" 
              onClick={handleAcknowledge}
            >
              Acknowledge
            </button>
          )}
        </div>

        {autoCloseDelay > 0 && (
          <div 
            className="auto-close-progress" 
            style={{ 
              animationDuration: `${autoCloseDelay}ms`,
              animationPlayState: isClosing ? 'paused' : 'running'
            }}
          />
        )}
      </div>
    </div>
  );
}

// Notification Toast Component (for less intrusive notifications)
function NotificationToast({ 
  notification, 
  isVisible, 
  onClose, 
  position = 'top-right',
  duration = 4000 
}) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (!isVisible) return;

    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onClose, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [isVisible, duration, onClose]);

  const getToastClass = () => {
    let baseClass = 'notification-toast';
    
    if (notification?.event_type?.includes('error')) {
      baseClass += ' toast-error';
    } else if (notification?.event_type?.includes('success')) {
      baseClass += ' toast-success';
    } else if (notification?.event_type?.includes('warning')) {
      baseClass += ' toast-warning';
    } else {
      baseClass += ' toast-info';
    }

    if (isExiting) baseClass += ' toast-exit';
    if (isVisible) baseClass += ' toast-enter';

    return baseClass;
  };

  if (!isVisible || !notification) return null;

  return (
    <div className={`toast-container ${position}`}>
      <div className={getToastClass()}>
        <div className="toast-content">
          <div className="toast-icon">
            {getNotificationIcon(notification.event_type)}
          </div>
          <div className="toast-text">
            <div className="toast-title">
              {notification.title}
            </div>
            <div className="toast-message">
              {notification.message}
            </div>
          </div>
          <button 
            className="toast-close" 
            onClick={() => {
              setIsExiting(true);
              setTimeout(onClose, 300);
            }}
          >
            ×
          </button>
        </div>
        <div className="toast-progress" style={{ animationDuration: `${duration}ms` }} />
      </div>
    </div>
  );
}

// Notification Queue Manager Component
function NotificationQueue({ 
  notifications = [], 
  onNotificationClose,
  onNotificationAcknowledge,
  maxVisible = 3,
  useToasts = false 
}) {
  const [visibleNotifications, setVisibleNotifications] = useState([]);
  const [currentModal, setCurrentModal] = useState(null);

  useEffect(() => {
    if (useToasts) {
      // Show multiple toast notifications
      setVisibleNotifications(notifications.slice(0, maxVisible));
    } else {
      // Show one modal at a time
      if (notifications.length > 0 && !currentModal) {
        setCurrentModal(notifications[0]);
      }
    }
  }, [notifications, maxVisible, useToasts, currentModal]);

  const handleModalClose = () => {
    if (currentModal) {
      onNotificationClose(currentModal.id);
      setCurrentModal(null);
      
      // Show next notification after a brief delay
      setTimeout(() => {
        const remaining = notifications.filter(n => n.id !== currentModal.id);
        if (remaining.length > 0) {
          setCurrentModal(remaining[0]);
        }
      }, 500);
    }
  };

  const handleToastClose = (notificationId) => {
    setVisibleNotifications(prev => prev.filter(n => n.id !== notificationId));
    onNotificationClose(notificationId);
  };

  if (useToasts) {
    return (
      <>
        {visibleNotifications.map((notification, index) => (
          <NotificationToast
            key={notification.id}
            notification={notification}
            isVisible={true}
            onClose={() => handleToastClose(notification.id)}
            position={`top-right-${index}`}
          />
        ))}
      </>
    );
  }

  return (
    <NotificationModal
      notification={currentModal}
      isOpen={!!currentModal}
      onClose={handleModalClose}
      onAcknowledge={onNotificationAcknowledge}
    />
  );
}

export default NotificationModal;
export { NotificationToast, NotificationQueue };