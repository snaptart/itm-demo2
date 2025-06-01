import React from 'react';
import './ConfirmationModal.css';

function ConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  loading = false
}) {
  if (!isOpen) return null;

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

  return (
    <div className="confirmation-overlay" onClick={handleClose}>
      <div className="confirmation-modal" onClick={(e) => e.stopPropagation()}>
        <div className={`confirmation-icon ${type}`}>
          {type === 'warning' && '⚠️'}
          {type === 'danger' && '🗑️'}
          {type === 'info' && 'ℹ️'}
        </div>
        
        <h3 className="confirmation-title">{title}</h3>
        <p className="confirmation-message">{message}</p>
        
        <div className="confirmation-actions">
          <button 
            className="btn btn-secondary" 
            onClick={handleClose}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button 
            className={`btn btn-${type === 'danger' ? 'danger' : 'primary'}`}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmationModal;