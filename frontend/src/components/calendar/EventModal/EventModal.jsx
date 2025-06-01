<!-- frontend/src/components/calendar/EventModal/EventModal.jsx -->
import React, { useState, useEffect } from 'react';
import ConfirmationModal from '../../common/ConfirmationModal/ConfirmationModal';
import LoadingSpinner from '../../common/LoadingSpinner/LoadingSpinner';
import './EventModal.css';

function EventModal({ 
  event, 
  isAdmin, 
  onClose, 
  onUpdate, 
  onSuccess,
  onError,
  calendarService 
}) {
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [episodeDetails, setEpisodeDetails] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Form state
  const [editData, setEditData] = useState({
    episode_title: '',
    episode_description: '',
    episode_price: '',
    episode_status: 'available'
  });

  // Form validation state
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    if (event?.episode_id) {
      loadEpisodeDetails();
    }
  }, [event]);

  const loadEpisodeDetails = async () => {
    if (!calendarService || !event?.episode_id) {
      setLoadingDetails(false);
      return;
    }

    try {
      setLoadingDetails(true);
      setError('');
      
      const result = await calendarService.getEpisodeById(event.episode_id);
      
      if (result.success) {
        setEpisodeDetails(result.data.episode);
        setEditData({
          episode_title: result.data.episode.episode_title || '',
          episode_description: result.data.episode.episode_description || '',
          episode_price: result.data.episode.episode_price || '',
          episode_status: result.data.episode.episode_status || 'available'
        });
      } else {
        setError(result.error || 'Failed to load episode details');
      }
    } catch (err) {
      setError('Failed to load episode details');
      console.error('Load episode details error:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    setError('');
    setValidationErrors({});
    
    // Reset form data when canceling edit
    if (isEditing && episodeDetails) {
      setEditData({
        episode_title: episodeDetails.episode_title || '',
        episode_description: episodeDetails.episode_description || '',
        episode_price: episodeDetails.episode_price || '',
        episode_status: episodeDetails.episode_status || 'available'
      });
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!editData.episode_title.trim()) {
      errors.episode_title = 'Title is required';
    }
    
    if (editData.episode_price !== '' && editData.episode_price < 0) {
      errors.episode_price = 'Price cannot be negative';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    if (!calendarService || !episodeDetails) {
      setError('Unable to save changes');
      return;
    }

    try {
      setIsSaving(true);
      setError('');

      // Prepare update data
      const updateData = {
        episode_title: editData.episode_title.trim(),
        episode_description: editData.episode_description.trim(),
        episode_price: editData.episode_price === '' ? null : parseFloat(editData.episode_price),
        episode_status: editData.episode_status
      };

      const result = await calendarService.updateEpisode(episodeDetails.episode_id, updateData);
      
      if (result.success) {
        setIsEditing(false);
        // Reload episode details
        await loadEpisodeDetails();
        
        if (onSuccess) {
          onSuccess('Ice time updated successfully');
        }
        
        if (onUpdate) {
          onUpdate();
        }
      } else {
        setError(result.error || 'Failed to update episode');
        if (onError) {
          onError(result.error || 'Failed to update episode');
        }
      }
    } catch (err) {
      const errorMessage = 'Failed to save changes';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
      console.error('Save episode error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!calendarService || !episodeDetails) {
      setError('Unable to delete episode');
      return;
    }

    try {
      setIsDeleting(true);
      setError('');

      const result = await calendarService.deleteEpisode(episodeDetails.episode_id);
      
      if (result.success) {
        if (onSuccess) {
          onSuccess('Ice time deleted successfully');
        }
        
        if (onUpdate) {
          onUpdate();
        }
        
        onClose();
      } else {
        setError(result.error || 'Failed to delete episode');
        if (onError) {
          onError(result.error || 'Failed to delete episode');
        }
      }
    } catch (err) {
      const errorMessage = 'Failed to delete episode';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
      console.error('Delete episode error:', err);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    const statusClasses = {
      'available': 'status-available',
      'assigned': 'status-assigned',
      'pending': 'status-pending',
      'booked': 'status-booked',
      'maintenance': 'status-maintenance',
      'cancelled': 'status-cancelled'
    };
    return statusClasses[status] || '';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'available': 'Available',
      'assigned': 'Assigned',
      'pending': 'Pending',
      'booked': 'Booked',
      'maintenance': 'Maintenance',
      'cancelled': 'Cancelled'
    };
    return labels[status] || status;
  };

  const canDelete = () => {
    if (!episodeDetails) return false;
    // Cannot delete if there are bookings
    return !episodeDetails.bookings || episodeDetails.bookings.length === 0;
  };

  const canEdit = () => {
    if (!episodeDetails) return false;
    // Cannot edit if status is booked
    return episodeDetails.episode_status !== 'booked';
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{isEditing ? 'Edit Ice Time' : 'Ice Time Details'}</h2>
            <button className="modal-close" onClick={onClose} disabled={isSaving || isDeleting}>×</button>
          </div>

          {error && (
            <div className="modal-error">
              {error}
            </div>
          )}

          <div className="modal-body">
            {loadingDetails ? (
              <LoadingSpinner size="small" message="Loading details..." />
            ) : episodeDetails ? (
              <>
                {isEditing ? (
                  <div className="edit-form">
                    <div className="form-group">
                      <label>Title *</label>
                      <input
                        type="text"
                        name="episode_title"
                        value={editData.episode_title}
                        onChange={handleInputChange}
                        placeholder="Ice Time Title"
                        disabled={isSaving}
                        className={validationErrors.episode_title ? 'error' : ''}
                      />
                      {validationErrors.episode_title && (
                        <span className="field-error">{validationErrors.episode_title}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label>Description</label>
                      <textarea
                        name="episode_description"
                        value={editData.episode_description}
                        onChange={handleInputChange}
                        placeholder="Add description..."
                        rows={3}
                        disabled={isSaving}
                      />
                    </div>

                    <div className="form-group">
                      <label>Price</label>
                      <input
                        type="number"
                        name="episode_price"
                        value={editData.episode_price}
                        onChange={handleInputChange}
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        disabled={isSaving}
                        className={validationErrors.episode_price ? 'error' : ''}
                      />
                      {validationErrors.episode_price && (
                        <span className="field-error">{validationErrors.episode_price}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label>Status</label>
                      <select
                        name="episode_status"
                        value={editData.episode_status}
                        onChange={handleInputChange}
                        disabled={isSaving}
                      >
                        <option value="available">Available</option>
                        <option value="assigned">Assigned</option>
                        <option value="pending">Pending</option>
                        <option value="booked">Booked</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="event-details">
                    <div className="detail-row">
                      <span className="detail-label">Time:</span>
                      <span className="detail-value">
                        {formatDateTime(episodeDetails.episode_start_date_time)}
                        <br />
                        to {formatDateTime(episodeDetails.episode_end_date_time)}
                      </span>
                    </div>

                    <div className="detail-row">
                      <span className="detail-label">Duration:</span>
                      <span className="detail-value">{episodeDetails.episode_duration} minutes</span>
                    </div>

                    <div className="detail-row">
                      <span className="detail-label">Facility:</span>
                      <span className="detail-value">{episodeDetails.event?.resource?.facility?.facility_name || 'N/A'}</span>
                    </div>

                    <div className="detail-row">
                      <span className="detail-label">Rink:</span>
                      <span className="detail-value">{episodeDetails.event?.resource?.resource_name || 'N/A'}</span>
                    </div>

                    <div className="detail-row">
                      <span className="detail-label">Status:</span>
                      <span className={`status-badge ${getStatusBadgeClass(episodeDetails.episode_status)}`}>
                        {getStatusLabel(episodeDetails.episode_status)}
                      </span>
                    </div>

                    <div className="detail-row">
                      <span className="detail-label">Price:</span>
                      <span className="detail-value">
                        {formatCurrency(episodeDetails.episode_price)}
                      </span>
                    </div>

                    {episodeDetails.episode_description && (
                      <div className="detail-row">
                        <span className="detail-label">Description:</span>
                        <span className="detail-value">{episodeDetails.episode_description}</span>
                      </div>
                    )}

                    {episodeDetails.program && (
                      <div className="detail-row">
                        <span className="detail-label">Program:</span>
                        <span className="detail-value">{episodeDetails.program.program_name}</span>
                      </div>
                    )}

                    {episodeDetails.assignedProgram && (
                      <div className="detail-row">
                        <span className="detail-label">Assigned To:</span>
                        <span className="detail-value">{episodeDetails.assignedProgram.program_name}</span>
                      </div>
                    )}

                    {episodeDetails.bookings && episodeDetails.bookings.length > 0 && (
                      <div className="bookings-section">
                        <h3>Bookings ({episodeDetails.bookings.length})</h3>
                        {episodeDetails.bookings.map(booking => (
                          <div key={booking.booking_id} className="booking-item">
                            <div>
                              <strong>{booking.program.program_name}</strong>
                              <br />
                              <small>by {booking.user.first_name} {booking.user.last_name}</small>
                            </div>
                            <span className={`status-badge ${booking.booking_status}`}>
                              {booking.booking_status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">
                <p>Unable to load episode details</p>
              </div>
            )}
          </div>

          <div className="modal-footer">
            {isAdmin && episodeDetails && (
              <>
                {isEditing ? (
                  <>
                    <button 
                      className="btn btn-secondary" 
                      onClick={handleEditToggle}
                      disabled={isSaving}
                    >
                      Cancel
                    </button>
                    <button 
                      className="btn btn-primary" 
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <span className="btn-spinner"></span>
                          Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      className="btn btn-danger" 
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={!canDelete() || loading}
                      title={!canDelete() ? 'Cannot delete episode with bookings' : ''}
                    >
                      Delete
                    </button>
                    <button 
                      className="btn btn-primary" 
                      onClick={handleEditToggle}
                      disabled={!canEdit() || loading}
                      title={!canEdit() ? 'Cannot edit booked episodes' : ''}
                    >
                      Edit
                    </button>
                  </>
                )}
              </>
            )}
            
            {!isAdmin && episodeDetails?.episode_status === 'available' && (
              <button className="btn btn-primary" disabled>
                Request Booking (Coming Soon)
              </button>
            )}
            
            <button 
              className="btn btn-secondary" 
              onClick={onClose}
              disabled={isSaving || isDeleting}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Ice Time"
        message="Are you sure you want to delete this ice time slot? This action cannot be undone."
        confirmText="Delete"
        type="danger"
        loading={isDeleting}
      />
    </>
  );
}

export default EventModal;

/* Additional CSS for enhanced EventModal */
.field-error {
  display: block;
  color: #ef4444;
  font-size: 12px;
  margin-top: 4px;
}

.form-group input.error,
.form-group textarea.error {
  border-color: #ef4444;
}

.form-group input.error:focus,
.form-group textarea.error:focus {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.btn-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid #ffffff;
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 0.8s linear infinite;
  margin-right: 8px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #718096;
}

.booking-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f7fafc;
}

.booking-item:last-child {
  border-bottom: none;
}

.booking-item small {
  color: #718096;
  font-size: 12px;
}