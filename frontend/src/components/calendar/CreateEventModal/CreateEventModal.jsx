import React, { useState, useEffect } from 'react';
import './CreateEventModal.css';

function CreateEventModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  selectedDate,
  selectedResource,
  facility,
  calendarService,
  resourceService
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resources, setResources] = useState([]);
  
  // Safety check for required props
  if (!isOpen || !facility) {
    return null;
  }
  
  const [formData, setFormData] = useState({
    resource_id: selectedResource || '',
    event_date: selectedDate ? selectedDate.toISOString().split('T')[0] : '',
    start_time: '08:00',
    end_time: '09:00',
    episode_duration: 60,
    episode_price: 150.00,
    episode_title: '',
    episode_description: '',
    repeat_mode: 'once',
    repeat_end_date: '',
    repeat_days: [],
    generate_episodes: true
  });

  useEffect(() => {
    if (facility && isOpen) {
      loadResources();
    }
  }, [facility, isOpen]);

  useEffect(() => {
    if (selectedDate) {
      setFormData(prev => ({
        ...prev,
        event_date: selectedDate.toISOString().split('T')[0]
      }));
    }
  }, [selectedDate]);

  useEffect(() => {
    if (selectedResource) {
      setFormData(prev => ({
        ...prev,
        resource_id: selectedResource
      }));
    }
  }, [selectedResource]);

  const loadResources = async () => {
    if (!resourceService) {
      console.error('resourceService not provided');
      return;
    }
    
    try {
      const result = await resourceService.getResourcesByFacility(facility.facility_id);
      if (result.success) {
        setResources(result.data);
        
        // Auto-select if only one resource
        if (result.data.length === 1 && !formData.resource_id) {
          setFormData(prev => ({
            ...prev,
            resource_id: result.data[0].resource_id
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load resources:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      if (name === 'repeat_days') {
        const dayValue = parseInt(value);
        setFormData(prev => ({
          ...prev,
          repeat_days: checked 
            ? [...prev.repeat_days, dayValue]
            : prev.repeat_days.filter(d => d !== dayValue)
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          [name]: checked
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const validateForm = () => {
    if (!formData.resource_id) {
      setError('Please select a rink');
      return false;
    }
    
    if (!formData.event_date) {
      setError('Please select a date');
      return false;
    }
    
    if (!formData.start_time || !formData.end_time) {
      setError('Please select start and end times');
      return false;
    }
    
    const start = new Date(`${formData.event_date}T${formData.start_time}`);
    const end = new Date(`${formData.event_date}T${formData.end_time}`);
    
    if (start >= end) {
      setError('End time must be after start time');
      return false;
    }
    
    if (formData.repeat_mode !== 'once') {
      if (formData.repeat_mode === 'weekly' && formData.repeat_days.length === 0) {
        setError('Please select at least one day for weekly recurrence');
        return false;
      }
      
      if (!formData.repeat_end_date) {
        setError('Please select an end date for recurring events');
        return false;
      }
      
      const repeatEnd = new Date(formData.repeat_end_date);
      if (repeatEnd <= start) {
        setError('Repeat end date must be after the start date');
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }
    
    if (!calendarService) {
      setError('Calendar service not available');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // Prepare event data
      const eventData = {
        resource_id: parseInt(formData.resource_id),
        event_start_date_time: `${formData.event_date}T${formData.start_time}:00`,
        event_end_date_time: `${formData.event_date}T${formData.end_time}:00`,
        episode_duration: parseInt(formData.episode_duration),
        repeat_mode: formData.repeat_mode,
        generate_episodes: formData.generate_episodes
      };
      
      // Add recurring event data if applicable
      if (formData.repeat_mode !== 'once') {
        eventData.repeat_end_date = formData.repeat_end_date;
        if (formData.repeat_mode === 'weekly') {
          eventData.repeat_days = formData.repeat_days;
        }
      }
      
      // Add episode data
      if (formData.generate_episodes) {
        eventData.episode_data = {
          episode_title: formData.episode_title || `Ice Time - ${resources.find(r => r.resource_id === parseInt(formData.resource_id))?.resource_name}`,
          episode_description: formData.episode_description,
          episode_price: parseFloat(formData.episode_price)
        };
      }
      
      const result = await calendarService.createEvent(eventData);
      
      if (result.success) {
        onSuccess();
        handleClose();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to create ice time');
      console.error('Create event error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      resource_id: '',
      event_date: '',
      start_time: '08:00',
      end_time: '09:00',
      episode_duration: 60,
      episode_price: 150.00,
      episode_title: '',
      episode_description: '',
      repeat_mode: 'once',
      repeat_end_date: '',
      repeat_days: [],
      generate_episodes: true
    });
    setError('');
    onClose();
  };

  const getDayName = (dayIndex) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayIndex];
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content create-event-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Ice Time</h2>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>

        {error && (
          <div className="modal-error">
            {error}
          </div>
        )}

        <div className="create-event-form">
          <div className="modal-body">
            <div className="form-section">
              <h3>Basic Information</h3>
              
              <div className="form-group">
                <label>Rink *</label>
                <select
                  name="resource_id"
                  value={formData.resource_id}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                >
                  <option value="">Select a rink...</option>
                  {resources.map(resource => (
                    <option key={resource.resource_id} value={resource.resource_id}>
                      {resource.resource_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Date *</label>
                  <input
                    type="date"
                    name="event_date"
                    value={formData.event_date}
                    onChange={handleInputChange}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>Start Time *</label>
                  <input
                    type="time"
                    name="start_time"
                    value={formData.start_time}
                    onChange={handleInputChange}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>End Time *</label>
                  <input
                    type="time"
                    name="end_time"
                    value={formData.end_time}
                    onChange={handleInputChange}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Slot Duration (minutes)</label>
                  <select
                    name="episode_duration"
                    value={formData.episode_duration}
                    onChange={handleInputChange}
                    disabled={loading}
                  >
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="90">90 minutes</option>
                    <option value="120">120 minutes</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Price per Slot</label>
                  <input
                    type="number"
                    name="episode_price"
                    value={formData.episode_price}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Title (optional)</label>
                <input
                  type="text"
                  name="episode_title"
                  value={formData.episode_title}
                  onChange={handleInputChange}
                  placeholder="e.g., Public Skate, Hockey Practice"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>Description (optional)</label>
                <textarea
                  name="episode_description"
                  value={formData.episode_description}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Additional details about this ice time..."
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-section">
              <h3>Recurrence</h3>
              
              <div className="form-group">
                <label>Repeat</label>
                <select
                  name="repeat_mode"
                  value={formData.repeat_mode}
                  onChange={handleInputChange}
                  disabled={loading}
                >
                  <option value="once">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                </select>
              </div>

              {formData.repeat_mode === 'weekly' && (
                <div className="form-group">
                  <label>Repeat on</label>
                  <div className="weekday-checkboxes">
                    {[0, 1, 2, 3, 4, 5, 6].map(day => (
                      <label key={day} className="checkbox-label">
                        <input
                          type="checkbox"
                          name="repeat_days"
                          value={day}
                          checked={formData.repeat_days.includes(day)}
                          onChange={handleInputChange}
                          disabled={loading}
                        />
                        <span>{getDayName(day).substr(0, 3)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {formData.repeat_mode !== 'once' && (
                <div className="form-group">
                  <label>End Date *</label>
                  <input
                    type="date"
                    name="repeat_end_date"
                    value={formData.repeat_end_date}
                    onChange={handleInputChange}
                    min={formData.event_date}
                    required={formData.repeat_mode !== 'once'}
                    disabled={loading}
                  />
                </div>
              )}
            </div>

            <div className="form-section">
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="generate_episodes"
                    checked={formData.generate_episodes}
                    onChange={handleInputChange}
                    disabled={loading}
                  />
                  <span>Automatically create time slots based on duration</span>
                </label>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button 
              type="button"
              className="btn btn-secondary" 
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="button"
              className="btn btn-primary" 
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Ice Time'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateEventModal;