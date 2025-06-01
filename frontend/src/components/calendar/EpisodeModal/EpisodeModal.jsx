import React, { useState, useEffect } from 'react';
import './EpisodeModal.css';

function EpisodeModal({ 
  episode, 
  facility, 
  resources, 
  isAdmin, 
  onSave, 
  onDelete, 
  onClose 
}) {
  const [formData, setFormData] = useState({
    episode_title: '',
    episode_description: '',
    episode_start_date_time: '',
    episode_end_date_time: '',
    episode_duration: 60,
    episode_price: '',
    episode_status: 'available',
    resource_id: ''
  });

  useEffect(() => {
    if (episode) {
      if (episode.episode_id) {
        // Editing existing episode
        setFormData({
          episode_title: episode.episode_title || '',
          episode_description: episode.episode_description || '',
          episode_start_date_time: formatDateTimeLocal(episode.episode_start_date_time),
          episode_end_date_time: formatDateTimeLocal(episode.episode_end_date_time),
          episode_duration: episode.episode_duration || 60,
          episode_price: episode.episode_price || '',
          episode_status: episode.episode_status || 'available',
          resource_id: episode.resource_id || ''
        });
      } else {
        // Creating new episode
        const startDateTime = new Date(episode.date);
        const [hours, minutes] = episode.time.split(':');
        startDateTime.setHours(parseInt(hours), parseInt(minutes));
        
        const endDateTime = new Date(startDateTime);
        endDateTime.setHours(endDateTime.getHours() + 1);
        
        setFormData({
          ...formData,
          episode_start_date_time: formatDateTimeLocal(startDateTime),
          episode_end_date_time: formatDateTimeLocal(endDateTime),
          resource_id: episode.resource_id
        });
      }
    }
  }, [episode]);

  const formatDateTimeLocal = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Auto-calculate end time when start time changes
    if (name === 'episode_start_date_time' && value) {
      const startDate = new Date(value);
      const duration = parseInt(formData.episode_duration) || 60;
      const endDate = new Date(startDate.getTime() + duration * 60000);
      setFormData(prev => ({
        ...prev,
        episode_end_date_time: formatDateTimeLocal(endDate)
      }));
    }

    // Auto-calculate duration when end time changes
    if (name === 'episode_end_date_time' && value && formData.episode_start_date_time) {
      const startDate = new Date(formData.episode_start_date_time);
      const endDate = new Date(value);
      const durationMinutes = Math.round((endDate - startDate) / 60000);
      setFormData(prev => ({
        ...prev,
        episode_duration: durationMinutes
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Prepare data for backend
    const episodeData = {
      ...formData,
      episode_price: parseFloat(formData.episode_price) || null,
      episode_duration: parseInt(formData.episode_duration),
      facility_id: facility.facility_id
    };

    onSave(episodeData);
  };

  const canEditOrDelete = isAdmin && (!episode?.episode_id || episode.episode_status === 'available');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{episode?.episode_id ? 'Edit Ice Time' : 'Create Ice Time'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="episode-form">
          <div className="form-group">
            <label htmlFor="episode_title">Title</label>
            <input
              type="text"
              id="episode_title"
              name="episode_title"
              value={formData.episode_title}
              onChange={handleChange}
              placeholder="Ice Time"
              disabled={!canEditOrDelete}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="resource_id">Rink</label>
              <select
                id="resource_id"
                name="resource_id"
                value={formData.resource_id}
                onChange={handleChange}
                required
                disabled={!canEditOrDelete}
              >
                <option value="">Select a rink...</option>
                {resources.map(resource => (
                  <option key={resource.resource_id} value={resource.resource_id}>
                    {resource.resource_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="episode_status">Status</label>
              <select
                id="episode_status"
                name="episode_status"
                value={formData.episode_status}
                onChange={handleChange}
                disabled={!isAdmin}
              >
                <option value="available">Available</option>
                <option value="pending">Pending Approval</option>
                <option value="booked">Booked</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="episode_start_date_time">Start Time</label>
              <input
                type="datetime-local"
                id="episode_start_date_time"
                name="episode_start_date_time"
                value={formData.episode_start_date_time}
                onChange={handleChange}
                required
                disabled={!canEditOrDelete}
              />
            </div>

            <div className="form-group">
              <label htmlFor="episode_end_date_time">End Time</label>
              <input
                type="datetime-local"
                id="episode_end_date_time"
                name="episode_end_date_time"
                value={formData.episode_end_date_time}
                onChange={handleChange}
                required
                disabled={!canEditOrDelete}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="episode_duration">Duration (minutes)</label>
              <input
                type="number"
                id="episode_duration"
                name="episode_duration"
                value={formData.episode_duration}
                onChange={handleChange}
                min="15"
                max="480"
                step="15"
                disabled={!canEditOrDelete}
              />
            </div>

            <div className="form-group">
              <label htmlFor="episode_price">Price per Hour ($)</label>
              <input
                type="number"
                id="episode_price"
                name="episode_price"
                value={formData.episode_price}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="150.00"
                disabled={!canEditOrDelete}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="episode_description">Description</label>
            <textarea
              id="episode_description"
              name="episode_description"
              value={formData.episode_description}
              onChange={handleChange}
              rows="3"
              placeholder="Additional notes or description..."
              disabled={!canEditOrDelete}
            />
          </div>

          {episode?.booking_info && (
            <div className="booking-info">
              <h3>Booking Information</h3>
              <p><strong>Program:</strong> {episode.booking_info.program_name}</p>
              <p><strong>Requested by:</strong> {episode.booking_info.requester_name}</p>
              <p><strong>Status:</strong> {episode.booking_info.booking_status}</p>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            {canEditOrDelete && episode?.episode_id && (
              <button 
                type="button" 
                className="btn-danger" 
                onClick={onDelete}
              >
                Delete
              </button>
            )}
            {(isAdmin || !episode?.episode_id) && (
              <button type="submit" className="btn-primary">
                {episode?.episode_id ? 'Update' : 'Create'} Ice Time
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default EpisodeModal;