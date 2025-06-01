import React from 'react';
import './ErrorMessage.css';

function ErrorMessage({ 
  message, 
  type = 'error', 
  onDismiss,
  actionButton 
}) {
  return (
    <div className={`error-message ${type}`}>
      <div className="error-content">
        <span className="error-icon">
          {type === 'error' && '❌'}
          {type === 'warning' && '⚠️'}
          {type === 'info' && 'ℹ️'}
          {type === 'success' && '✅'}
        </span>
        <p className="error-text">{message}</p>
      </div>
      <div className="error-actions">
        {actionButton && (
          <button 
            className="error-action-btn"
            onClick={actionButton.onClick}
          >
            {actionButton.label}
          </button>
        )}
        {onDismiss && (
          <button 
            className="error-dismiss-btn"
            onClick={onDismiss}
            aria-label="Dismiss message"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export default ErrorMessage;