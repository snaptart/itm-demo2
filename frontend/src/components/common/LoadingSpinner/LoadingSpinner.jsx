// frontend/src/components/common/LoadingSpinner/LoadingSpinner.jsx
import React from 'react';
import './LoadingSpinner.css';

function LoadingSpinner({ size = 'medium', message = '' }) {
  return (
    <div className={`loading-spinner-container ${size}`}>
      <div className="loading-spinner"></div>
      {message && <p className="loading-message">{message}</p>}
    </div>
  );
}

export default LoadingSpinner;