// frontend/src/components/calendar/DragDropConfirmModal/DragDropConfirmModal.jsx
import React, { useState, useEffect } from 'react';
import { dateUtils } from '../../../utils/dateUtils';
import './DragDropConfirmModal.css';

function DragDropConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  moveData,
  loading = false
}) {
  const [showDetails, setShowDetails] = useState(false);

  if (!isOpen || !moveData) return null;

  const {
    episodeTitle,
    originalStart,
    originalEnd,
    newStart,
    newEnd,
    resourceName,
    facilityName,
    moveType = 'move', // 'move' or 'resize'
    conflicts = [],
    warnings = []
  } = moveData;

  const hasConflicts = conflicts.length > 0;
  const hasWarnings = warnings.length > 0;
  const canProceed = !hasConflicts;

  const handleConfirm = () => {
    if (canProceed && !loading) {
      onConfirm();
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const formatTimeChange = () => {
    if (moveType === 'resize') {
      return (
        <>
          <div className="time-change-item">
            <span className="time-label">Original Duration:</span>
            <span className="time-value">
              {dateUtils.formatDuration(dateUtils.getDuration(originalStart, originalEnd))}
            </span>
          </div>
          <div className="time-change-item">
            <span className="time-label">New Duration:</span>
            <span className="time-value">
              {dateUtils.formatDuration(dateUtils.getDuration(newStart, newEnd))}
            </span>
          </div>
        </>
      );
    } else {
      return (
        <>
          <div className="time-change-item">
            <span className="time-label">From:</span>
            <span className="time-value">
              {dateUtils.formatForDisplay(originalStart)} - {dateUtils.formatTimeOnly(originalEnd)}
            </span>
          </div>
          <div className="time-change-item">
            <span className="time-label">To:</span>
            <span className="time-value">
              {dateUtils.formatForDisplay(newStart)} - {dateUtils.formatTimeOnly(newEnd)}
            </span>
          </div>
        </>
      );
    }
  };

  const getModalTitle = () => {
    if (hasConflicts) {
      return `Cannot ${moveType === 'resize' ? 'Resize' : 'Move'} Ice Time`;
    } else if (hasWarnings) {
      return `Confirm ${moveType === 'resize' ? 'Resize' : 'Move'} with Warnings`;
    } else {
      return `Confirm ${moveType === 'resize' ? 'Resize' : 'Move'} Ice Time`;
    }
  };

  const getModalClass = () => {
    if (hasConflicts) return 'error';
    if (hasWarnings) return 'warning';
    return 'success';
  };

  return (
    <div className="dragdrop-overlay" onClick={handleClose}>
      <div className={`dragdrop-modal ${getModalClass()}`} onClick={(e) => e.stopPropagation()}>
        <div className="dragdrop-header">
          <div className="header-icon">
            {hasConflicts && '❌'}
            {hasWarnings && !hasConflicts && '⚠️'}
            {!hasConflicts && !hasWarnings && '✅'}
          </div>
          <h3 className="dragdrop-title">{getModalTitle()}</h3>
          <button className="dragdrop-close" onClick={handleClose} disabled={loading}>
            ×
          </button>
        </div>

        <div className="dragdrop-body">
          <div className="episode-info">
            <h4 className="episode-title">{episodeTitle}</h4>
            <div className="episode-details">
              <div className="detail-item">
                <span className="detail-label">Facility:</span>
                <span className="detail-value">{facilityName}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Resource:</span>
                <span className="detail-value">{resourceName}</span>
              </div>
            </div>
          </div>

          <div className="time-changes">
            <h4 className="section-title">
              {moveType === 'resize' ? 'Duration Change' : 'Time Change'}
            </h4>
            <div className="time-change-details">
              {formatTimeChange()}
            </div>
          </div>

          {(hasConflicts || hasWarnings) && (
            <div className="issues-section">
              {hasConflicts && (
                <div className="conflicts-container">
                  <h4 className="issues-title conflicts">
                    <span className="issues-icon">⚠️</span>
                    Conflicts ({conflicts.length})
                  </h4>
                  <div className="issues-list">
                    {conflicts.map((conflict, index) => (
                      <div key={index} className="issue-item conflict">
                        <div className="issue-content">
                          <div className="issue-title">{conflict.title || 'Schedule Conflict'}</div>
                          <div className="issue-description">{conflict.description}</div>
                          {conflict.time && (
                            <div className="issue-time">Time: {conflict.time}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hasWarnings && (
                <div className="warnings-container">
                  <h4 className="issues-title warnings">
                    <span className="issues-icon">ℹ️</span>
                    Warnings ({warnings.length})
                  </h4>
                  <div className="issues-list">
                    {warnings.map((warning, index) => (
                      <div key={index} className="issue-item warning">
                        <div className="issue-content">
                          <div className="issue-title">{warning.title || 'Schedule Warning'}</div>
                          <div className="issue-description">{warning.description}</div>
                          {warning.time && (
                            <div className="issue-time">Time: {warning.time}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!hasConflicts && !hasWarnings && (
            <div className="success-message">
              <div className="success-icon">✅</div>
              <p>No conflicts detected. The schedule change can proceed safely.</p>
            </div>
          )}

          <div className="details-toggle">
            <button 
              className="toggle-button" 
              onClick={() => setShowDetails(!showDetails)}
              type="button"
            >
              {showDetails ? 'Hide Details' : 'Show Details'} 
              <span className={`toggle-arrow ${showDetails ? 'up' : 'down'}`}>▼</span>
            </button>
          </div>

          {showDetails && (
            <div className="additional-details">
              <div className="detail-section">
                <h5>Original Schedule</h5>
                <p>
                  <strong>Start:</strong> {dateUtils.formatForDisplay(originalStart)}<br />
                  <strong>End:</strong> {dateUtils.formatForDisplay(originalEnd)}<br />
                  <strong>Duration:</strong> {dateUtils.formatDuration(dateUtils.getDuration(originalStart, originalEnd))}
                </p>
              </div>
              <div className="detail-section">
                <h5>New Schedule</h5>
                <p>
                  <strong>Start:</strong> {dateUtils.formatForDisplay(newStart)}<br />
                  <strong>End:</strong> {dateUtils.formatForDisplay(newEnd)}<br />
                  <strong>Duration:</strong> {dateUtils.formatDuration(dateUtils.getDuration(newStart, newEnd))}
                </p>
              </div>
              {moveType === 'move' && (
                <div className="detail-section">
                  <h5>Change Summary</h5>
                  <p>
                    <strong>Time Shift:</strong> {getTimeShiftDescription()}<br />
                    <strong>Date Change:</strong> {getDateChangeDescription()}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="dragdrop-footer">
          <button 
            className="btn btn-secondary" 
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </button>
          
          {canProceed && (
            <button 
              className={`btn ${hasWarnings ? 'btn-warning' : 'btn-primary'}`}
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="btn-spinner"></span>
                  {moveType === 'resize' ? 'Resizing...' : 'Moving...'}
                </>
              ) : (
                <>
                  {hasWarnings ? 'Proceed Anyway' : 'Confirm Changes'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  function getTimeShiftDescription() {
    const originalTime = new Date(originalStart);
    const newTime = new Date(newStart);
    const diffMs = newTime.getTime() - originalTime.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60 * 100)) / 10;

    if (diffHours === 0) return 'No time change';
    if (diffHours > 0) return `${Math.abs(diffHours)} hours later`;
    return `${Math.abs(diffHours)} hours earlier`;
  }

  function getDateChangeDescription() {
    const originalDate = dateUtils.formatDateOnly(originalStart);
    const newDate = dateUtils.formatDateOnly(newStart);
    
    if (originalDate === newDate) return 'Same day';
    
    const diffDays = Math.round((new Date(newStart) - new Date(originalStart)) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return '1 day later';
    if (diffDays === -1) return '1 day earlier';
    if (diffDays > 0) return `${diffDays} days later`;
    return `${Math.abs(diffDays)} days earlier`;
  }
}

export default DragDropConfirmModal;