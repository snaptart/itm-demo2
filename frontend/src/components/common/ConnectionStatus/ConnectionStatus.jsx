// frontend/src/components/common/ConnectionStatus/ConnectionStatus.jsx
import React, { useEffect, useState } from 'react';
import { useUserPresence } from '../../../hooks/useRealtimeCalendar';
import './ConnectionStatus.css';

function ConnectionStatus({ facilityId, showUsers = true, compact = false }) {
  const { activeUsers, connectionStatus, totalUsers } = useUserPresence(facilityId);
  const [showUserList, setShowUserList] = useState(false);

  // Auto-hide disconnection warnings after 30 seconds
  useEffect(() => {
    if (!connectionStatus.connected && connectionStatus.error) {
      const timer = setTimeout(() => {
        // Could clear error state here if needed
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [connectionStatus]);

  const getConnectionIcon = () => {
    if (connectionStatus.connected) {
      return '🟢';
    } else if (connectionStatus.error) {
      return '🔴';
    } else {
      return '🟡';
    }
  };

  const getConnectionText = () => {
    if (connectionStatus.connected) {
      return compact ? 'Live' : 'Connected';
    } else if (connectionStatus.error) {
      return compact ? 'Offline' : 'Disconnected';
    } else {
      return compact ? 'Connecting' : 'Connecting...';
    }
  };

  const getConnectionClass = () => {
    if (connectionStatus.connected) {
      return 'connection-status connected';
    } else if (connectionStatus.error) {
      return 'connection-status disconnected';
    } else {
      return 'connection-status connecting';
    }
  };

  if (compact) {
    return (
      <div className={`${getConnectionClass()} compact`} title={`Real-time updates: ${getConnectionText()}`}>
        <span className="connection-icon">{getConnectionIcon()}</span>
        <span className="connection-text">{getConnectionText()}</span>
        {showUsers && totalUsers > 0 && (
          <span className="user-count" title={`${totalUsers} users online`}>
            {totalUsers}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={getConnectionClass()}>
      <div className="connection-info">
        <span className="connection-icon">{getConnectionIcon()}</span>
        <div className="connection-details">
          <span className="connection-text">{getConnectionText()}</span>
          {connectionStatus.error && (
            <span className="connection-error">{connectionStatus.error}</span>
          )}
        </div>
      </div>

      {showUsers && connectionStatus.connected && (
        <div className="users-section">
          <button 
            className="users-toggle"
            onClick={() => setShowUserList(!showUserList)}
            title={`${totalUsers} users online`}
          >
            <span className="users-icon">👥</span>
            <span className="users-count">{totalUsers}</span>
            <span className={`toggle-arrow ${showUserList ? 'up' : 'down'}`}>▼</span>
          </button>

          {showUserList && activeUsers.length > 0 && (
            <div className="users-list">
              <div className="users-list-header">
                <span>Active Users ({activeUsers.length})</span>
              </div>
              <div className="users-items">
                {activeUsers.map(user => (
                  <div key={user.userId} className="user-item">
                    <div className="user-info">
                      <span className="user-name">{user.username}</span>
                      <span className={`user-role ${user.userType}`}>
                        {user.userType === 'admin' ? 'Admin' : 'Scheduler'}
                      </span>
                    </div>
                    <div className="user-status">
                      <span className="status-indicator online"></span>
                      <span className="status-text">Online</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showUserList && activeUsers.length === 0 && (
            <div className="users-list">
              <div className="users-empty">
                <span>No other users online</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Notification Badge Component
function NotificationBadge({ count, onClick, className = '' }) {
  if (count === 0) return null;

  return (
    <button 
      className={`notification-badge ${className}`}
      onClick={onClick}
      title={`${count} unread notifications`}
    >
      <span className="badge-icon">🔔</span>
      {count > 0 && (
        <span className="badge-count">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

// Real-time Activity Indicator
function ActivityIndicator({ isActive, message = 'Live updates active' }) {
  if (!isActive) return null;

  return (
    <div className="activity-indicator">
      <span className="activity-pulse"></span>
      <span className="activity-message">{message}</span>
    </div>
  );
}

export default ConnectionStatus;
export { NotificationBadge, ActivityIndicator };