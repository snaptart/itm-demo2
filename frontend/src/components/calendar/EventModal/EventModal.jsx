// frontend/src/components/calendar/EventModal/EventModal.jsx - Enhanced Version
import React, { useState, useEffect } from 'react';
import ConfirmationModal from '../../common/ConfirmationModal/ConfirmationModal';
import LoadingSpinner from '../../common/LoadingSpinner/LoadingSpinner';
import programService from '../../../services/programService';
import { dateUtils } from '../../../utils/dateUtils';
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
  const [programs, setPrograms] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Form state
  const [editData, setEditData] = useState({
    episode_title: '',
    episode_description: '',
    episode_price: '',
    episode_status: 'available',
    assigned_to_program_id: ''
  });

  // Form validation state
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    if (event?.episode_id) {
      loadEpisodeDetails();
    }
  }, [event]);

  useEffect(() => {
    if (isAdmin && isEditing) {
      loadPrograms();
    }
  }, [isAdmin, isEditing]);

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
          episode_status: result.data.episode.episode_status || 'available',
          assigned_to_program_id: result.data.episode.assigned_to_program_id || ''
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

  const loadPrograms = async () => {
    try {
      setLoadingPrograms(true);
      const result = await programService.getPrograms({ 
        active_only: true,
        include_type: true 
      });
      
      if (result.success) {
        setPrograms(result.data.programs);
      } else {
        console.error('Failed to load programs:', result.error);
      }
    } catch (err) {
      console.error('Load programs error:', err);
    } finally {
      setLoadingPrograms(false);
    }
  };

  // Format datetime with timezone label
  const formatDateTime = (dateString, timezone) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    const formatted = dateUtils.formatForDisplay(date);
    const tzAbbr = dateUtils.getTimezoneDisplayName(timezone);
    
    return `${formatted} ${tzAbbr}`;
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
        episode_status: episodeDetails.episode_status || 'available',
        assigned_to_program_id: episodeDetails.assigned_to_program_id || ''
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
        episode_status: editData.episode_status,
        assigned_to_program_id: editData.assigned_to_program_id || null
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

                    <div className="form-group">
                      <label>Assign to Program</label>
                      <select
                        name="assigned_to_program_id"
                        value={editData.assigned_to_program_id}
                        onChange={handleInputChange}
                        disabled={isSaving || loadingPrograms}
                      >
                        <option value="">No program assigned</option>
                        {programs.map(program => (
                          <option key={program.program_id} value={program.program_id}>
                            {program.program_name}
                            {program.programType && ` (${program.programType.program_type_name})`}
                          </option>
                        ))}
                      </select>
                      {loadingPrograms && (
                        <small className="loading-text">Loading programs...</small>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="event-details">
                    <div className="detail-row">
                      <span className="detail-label">Time:</span>
                      <span className="detail-value">
                        {formatDateTime(episodeDetails.episode_start_date_time, episodeDetails.facilityTimezone)}
                        <br />
                        to {formatDateTime(episodeDetails.episode_end_date_time, episodeDetails.facilityTimezone)}
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