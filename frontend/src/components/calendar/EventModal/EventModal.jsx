import React, { useState } from 'react';
import './EventModal.css';

function EventModal({ event, isAdmin, onClose, onUpdate, calendarService }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  // Safety check for event object
  if (!event) {
    return null;
  }
  
  const [editData, setEditData] = useState({
    episode_title: event.episode_title || '',
    episode_description: event.episode_description || '',
    episode_price: event.episode_price || '',
    episode_status: event.episode_status || 'available'
  });

  const formatDateTime = (dateString) => {
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

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    setError('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    if (!calendarService) {
      setError('Calendar service not available');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const result = await calendarService.updateEpisode(event.episode_id, editData);
      
      if (result.success) {
        setIsEditing(false);
        onUpdate();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to update episode');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this ice time slot?')) {
      return;
    }

    if (!calendarService) {
      setError('Calendar service not available');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const result = await calendarService.deleteEpisode(event.episode_id);
      
      if (result.success) {
        onUpdate();
        onClose();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to delete episode');
    } finally {
      setLoading(false);
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Edit Ice Time' : 'Ice Time Details'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="modal-error">
            {error}
          </div>
        )}

        <div className="modal-body">
          {isEditing ? (
            <div className="edit-form">
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  name="episode_title"
                  value={editData.episode_title}
                  onChange={handleInputChange}
                  placeholder="Ice Time Title"
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="episode_description"
                  value={editData.episode_description}
                  onChange={handleInputChange}
                  placeholder="Add description..."
                  rows={3}
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
                />
              </div>

              <div className="form-group">
                <label>Status</label>
                <select
                  name="episode_status"
                  value={editData.episode_status}
                  onChange={handleInputChange}
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
                  {formatDateTime(event.episode_start_date_time)}
                  <br />
                  to {formatDateTime(event.episode_end_date_time)}
                </span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Duration:</span>
                <span className="detail-value">{event.episode_duration} minutes</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Facility:</span>
                <span className="detail-value">{event.event?.resource?.facility?.facility_name}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Rink:</span>
                <span className="detail-value">{event.event?.resource?.resource_name}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Status:</span>
                <span className={`status-badge ${getStatusBadgeClass(event.episode_status)}`}>
                  {event.episode_status}
                </span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Price:</span>
                <span className="detail-value">
                  ${parseFloat(event.episode_price || 0).toFixed(2)}
                </span>
              </div>

              {event.episode_description && (
                <div className="detail-row">
                  <span className="detail-label">Description:</span>
                  <span className="detail-value">{event.episode_description}</span>
                </div>
              )}

              {event.program && (
                <div className="detail-row">
                  <span className="detail-label">Program:</span>
                  <span className="detail-value">{event.program.program_name}</span>
                </div>
              )}

              {event.assignedProgram && (
                <div className="detail-row">
                  <span className="detail-label">Assigned To:</span>
                  <span className="detail-value">{event.assignedProgram.program_name}</span>
                </div>
              )}

              {event.bookings && event.bookings.length > 0 && (
                <div className="bookings-section">
                  <h3>Bookings</h3>
                  {event.bookings.map(booking => (
                    <div key={booking.booking_id} className="booking-item">
                      <span>{booking.program.program_name}</span>
                      <span className={`status-badge ${booking.booking_status}`}>
                        {booking.booking_status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {isAdmin && (
            <>
              {isEditing ? (
                <>
                  <button 
                    className="btn btn-secondary" 
                    onClick={handleEditToggle}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn btn-primary" 
                    onClick={handleSave}
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <>
                  <button 
                    className="btn btn-danger" 
                    onClick={handleDelete}
                    disabled={loading || (event.bookings && event.bookings.length > 0)}
                  >
                    Delete
                  </button>
                  <button 
                    className="btn btn-primary" 
                    onClick={handleEditToggle}
                    disabled={loading}
                  >
                    Edit
                  </button>
                </>
              )}
            </>
          )}
          
          {!isAdmin && event.episode_status === 'available' && (
            <button className="btn btn-primary">
              Request Booking
            </button>
          )}
          
          <button 
            className="btn btn-secondary" 
            onClick={onClose}
            disabled={loading}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default EventModal;