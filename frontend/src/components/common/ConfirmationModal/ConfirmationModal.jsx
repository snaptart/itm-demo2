<!-- frontend/src/components/common/ConfirmationModal/ConfirmationModal.jsx -->
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

/* frontend/src/components/common/ConfirmationModal/ConfirmationModal.css */
.confirmation-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.confirmation-modal {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  width: 100%;
  max-width: 400px;
  padding: 32px;
  text-align: center;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.confirmation-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.confirmation-icon.warning {
  color: #f59e0b;
}

.confirmation-icon.danger {
  color: #ef4444;
}

.confirmation-icon.info {
  color: #3b82f6;
}

.confirmation-title {
  margin: 0 0 12px 0;
  font-size: 20px;
  font-weight: 600;
  color: #1a202c;
}

.confirmation-message {
  margin: 0 0 24px 0;
  font-size: 14px;
  color: #4a5568;
  line-height: 1.5;
}

.confirmation-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.confirmation-actions .btn {
  min-width: 100px;
}

/* Responsive design */
@media (max-width: 480px) {
  .confirmation-modal {
    padding: 24px;
  }
  
  .confirmation-icon {
    font-size: 36px;
  }
  
  .confirmation-title {
    font-size: 18px;
  }
  
  .confirmation-actions {
    flex-direction: column-reverse;
    width: 100%;
  }
  
  .confirmation-actions .btn {
    width: 100%;
  }
}