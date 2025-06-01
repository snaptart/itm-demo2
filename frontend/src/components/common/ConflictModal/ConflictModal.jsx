// frontend/src/components/common/ConflictModal/ConflictModal.jsx
import React from 'react';
import './ConflictModal.css';

function ConflictModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  conflicts = [],
  warnings = [],
  title = 'Schedule Conflict Detected',
  confirmText = 'Continue Anyway',
  cancelText = 'Cancel',
  loading = false
}) {
  if (!isOpen) return null;

  const hasConflicts = conflicts.length > 0;
  const hasWarnings = warnings.length > 0;
  const hasIssues = hasConflicts || hasWarnings;

  const handleConfirm = () => {
    if (!loading) {
      onConfirm();
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const renderConflictItem = (item, index, type) => {
    return (
      <div key={index} className={`conflict-item ${type}`}>
        <div className="conflict-icon">
          {type === 'conflict' ? '⚠️' : 'ℹ️'}
        </div>
        <div className="conflict-content">
          <div className="conflict-title">{item.title || 'Schedule Issue'}</div>
          <div className="conflict-description">{item.description || item.message}</div>
          {item.details && (
            <div className="conflict-details">
              {Array.isArray(item.details) ? (
                <ul>
                  {item.details.map((detail, i) => (
                    <li key={i}>{detail}</li>
                  ))}
                </ul>
              ) : (
                <p>{item.details}</p>
              )}
            </div>
          )}
          {item.time && (
            <div className="conflict-time">
              <strong>Time:</strong> {item.time}
            </div>
          )}
          {item.resource && (
            <div className="conflict-resource">
              <strong>Resource:</strong> {item.resource}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="conflict-overlay" onClick={handleClose}>
      <div className="conflict-modal" onClick={(e) => e.stopPropagation()}>
        <div className="conflict-header">
          <h3 className="conflict-title-main">{title}</h3>
          <button className="conflict-close" onClick={handleClose} disabled={loading}>
            ×
          </button>
        </div>

        <div className="conflict-body">
          {!hasIssues ? (
            <div className="no-conflicts">
              <div className="success-icon">✅</div>
              <p>No conflicts detected. The schedule change can proceed safely.</p>
            </div>
          ) : (
            <>
              {hasConflicts && (
                <div className="conflicts-section">
                  <h4 className="section-title conflicts">
                    <span className="section-icon">⚠️</span>
                    Conflicts ({conflicts.length})
                  </h4>
                  <p className="section-description">
                    These conflicts must be resolved before proceeding:
                  </p>
                  <div className="conflicts-list">
                    {conflicts.map((conflict, index) => 
                      renderConflictItem(conflict, index, 'conflict')
                    )}
                  </div>
                </div>
              )}

              {hasWarnings && (
                <div className="warnings-section">
                  <h4 className="section-title warnings">
                    <span className="section-icon">ℹ️</span>
                    Warnings ({warnings.length})
                  </h4>
                  <p className="section-description">
                    These issues should be reviewed but don't prevent the change:
                  </p>
                  <div className="warnings-list">
                    {warnings.map((warning, index) => 
                      renderConflictItem(warning, index, 'warning')
                    )}
                  </div>
                </div>
              )}

              {hasConflicts && (
                <div className="resolution-help">
                  <h4>Suggested Actions:</h4>
                  <ul>
                    <li>Choose a different time slot</li>
                    <li>Check for available alternative resources</li>
                    <li>Contact affected parties to reschedule</li>
                    <li>Review facility business hours</li>
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="conflict-footer">
          <button 
            className="btn btn-secondary" 
            onClick={handleClose}
            disabled={loading}
          >
            {cancelText}
          </button>
          
          {hasWarnings && !hasConflicts && (
            <button 
              className="btn btn-warning" 
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="btn-spinner"></span>
                  Processing...
                </>
              ) : (
                confirmText
              )}
            </button>
          )}
          
          {!hasIssues && (
            <button 
              className="btn btn-primary" 
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="btn-spinner"></span>
                  Processing...
                </>
              ) : (
                'Proceed'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConflictModal;