// frontend/src/components/calendar/CreateEventModal/CreateEventModal.jsx (Fixed UTC Handling)
import React, { useState, useEffect, useMemo } from 'react';
import { dateUtils } from '../../../utils/dateUtils';
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
  const [timezoneInfo, setTimezoneInfo] = useState(null);
  const [businessHoursValidation, setBusinessHoursValidation] = useState(null);
  
  // Safety check for required props
  if (!isOpen || !facility) {
    return null;
  }
  
  // Determine facility timezone
  const facilityTimezone = facility.facility_time_zone || dateUtils.DEFAULT_TIMEZONE;
  
  // Helper function to calculate smart default times
  const calculateSmartDefaultTimes = (selectedDateInfo, facilityInfo) => {
    // If a specific time was clicked on the calendar, use it
    if (selectedDateInfo?.clickedTime && !selectedDateInfo.allDay) {
      const clickedDate = new Date(selectedDateInfo.clickedTime);
      const startTime = dateUtils.extractTimeString(clickedDate, facilityTimezone);
      
      // Calculate end time (1 hour later)
      const endDate = new Date(clickedDate);
      endDate.setHours(endDate.getHours() + 1);
      const endTime = dateUtils.extractTimeString(endDate, facilityTimezone);
      
      return { startTime, endTime };
    }
    
    // Otherwise, calculate smart defaults based on current time
    const now = new Date();
    const selectedDateObj = selectedDateInfo?.date ? new Date(selectedDateInfo.date) : now;
    
    // Check if selected date is today
    const isToday = selectedDateObj.toDateString() === now.toDateString();
    
    if (isToday) {
      // For today, find next available hour
      const currentHour = now.getHours();
      const currentMinutes = now.getMinutes();
      
      // Round up to next hour
      let startHour = currentMinutes > 0 ? currentHour + 1 : currentHour;
      
      // If we're past 10 PM, default to tomorrow's prime time
      if (startHour >= 22) {
        return { startTime: '18:00', endTime: '19:00' };
      }
      
      // If we're before 6 AM, start at 6 AM
      if (startHour < 6) {
        startHour = 6;
      }
      
      const startTime = `${String(startHour).padStart(2, '0')}:00`;
      const endTime = `${String(startHour + 1).padStart(2, '0')}:00`;
      
      return { startTime, endTime };
    } else {
      // For future dates, default to prime ice time (6 PM)
      return { startTime: '18:00', endTime: '19:00' };
    }
  };
  
  // Calculate initial times
  const defaultTimes = calculateSmartDefaultTimes(selectedDate, facility);
  
  const [formData, setFormData] = useState({
    resource_id: selectedResource || '',
    event_date: selectedDate ? dateUtils.extractDateString(selectedDate?.date || selectedDate, facilityTimezone) : '',
    start_time: defaultTimes.startTime,
    end_time: defaultTimes.endTime,
    episode_duration: 60,
    episode_price: 150.00,
    episode_title: '',
    episode_description: '',
    repeat_mode: 'once',
    repeat_end_date: '',
    repeat_days: [],
    generate_episodes: true
  });

  // Computed values for display
  const computedValues = useMemo(() => {
    if (!formData.event_date || !formData.start_time || !formData.end_time) {
      return null;
    }

    try {
      // Create facility datetime objects
      const facilityStartDateTime = dateUtils.createFacilityDateTime(
        formData.event_date, 
        formData.start_time, 
        facilityTimezone
      );
      const facilityEndDateTime = dateUtils.createFacilityDateTime(
        formData.event_date, 
        formData.end_time, 
        facilityTimezone
      );

      if (!facilityStartDateTime || !facilityEndDateTime) {
        return null;
      }

      // Convert to UTC for API
      const utcStartDateTime = dateUtils.convertFacilityTimeToUTC(facilityStartDateTime, facilityTimezone);
      const utcEndDateTime = dateUtils.convertFacilityTimeToUTC(facilityEndDateTime, facilityTimezone);

      const duration = dateUtils.getDuration(facilityStartDateTime, facilityEndDateTime);
      const isValidRange = facilityEndDateTime > facilityStartDateTime;
      const isPast = dateUtils.isPast(facilityStartDateTime, facilityTimezone);
      
      return {
        facilityStartDateTime,
        facilityEndDateTime,
        utcStartDateTime,
        utcEndDateTime,
        duration,
        isValidRange,
        isPast,
        displayStart: dateUtils.formatForDisplay(facilityStartDateTime, facilityTimezone, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }),
        displayEnd: dateUtils.formatTimeOnly(facilityEndDateTime, facilityTimezone),
        timezoneDisplay: dateUtils.getTimezoneDisplayName(facilityTimezone)
      };
    } catch (error) {
      console.error('Error computing values:', error);
      return null;
    }
  }, [formData.event_date, formData.start_time, formData.end_time, facilityTimezone]);

  useEffect(() => {
    if (facility && isOpen) {
      loadResources();
      loadTimezoneInfo();
    }
  }, [facility, isOpen]);

  useEffect(() => {
    if (selectedDate) {
      // Recalculate smart defaults when selected date changes
      const newDefaultTimes = calculateSmartDefaultTimes(selectedDate, facility);
      
      setFormData(prev => ({
        ...prev,
        event_date: dateUtils.extractDateString(selectedDate?.date || selectedDate, facilityTimezone),
        start_time: newDefaultTimes.startTime,
        end_time: newDefaultTimes.endTime
      }));
    }
  }, [selectedDate, facilityTimezone]);

  useEffect(() => {
    if (selectedResource) {
      setFormData(prev => ({
        ...prev,
        resource_id: selectedResource
      }));
    }
  }, [selectedResource]);

  // Validate business hours when time changes
  useEffect(() => {
    if (computedValues?.facilityStartDateTime && computedValues?.facilityEndDateTime) {
      validateBusinessHours();
    }
  }, [computedValues, facility]);

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

  const loadTimezoneInfo = () => {
    try {
      const info = {
        timezone: facilityTimezone,
        displayName: dateUtils.getTimezoneDisplayName(facilityTimezone),
        currentTime: dateUtils.formatForDisplay(
          new Date(), 
          facilityTimezone, 
          {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            timeZoneName: 'short'
          }
        ),
        businessHours: {
          start: facility.facility_daily_start_time || '06:00:00',
          end: facility.facility_daily_end_time || '23:00:00'
        }
      };
      setTimezoneInfo(info);
    } catch (error) {
      console.error('Failed to load timezone info:', error);
    }
  };

  const validateBusinessHours = () => {
    if (!computedValues || !timezoneInfo) return;

    const startTime = formData.start_time;
    const endTime = formData.end_time;
    const businessStart = timezoneInfo.businessHours.start.slice(0, 5); // HH:MM
    const businessEnd = timezoneInfo.businessHours.end.slice(0, 5); // HH:MM

    const violations = [];
    const warnings = [];

    // Check if times are within business hours
    if (startTime < businessStart || endTime > businessEnd) {
      violations.push({
        type: 'business_hours',
        message: `Times must be between ${businessStart} - ${businessEnd} (${timezoneInfo.displayName})`
      });
    }

    // Check for unusual hours
    const startHour = parseInt(startTime.split(':')[0]);
    const endHour = parseInt(endTime.split(':')[0]);
    
    if (startHour < 6 || endHour > 22) {
      warnings.push({
        type: 'unusual_hours',
        message: 'This is outside typical arena operating hours'
      });
    }

    // Check if crossing midnight
    if (endTime <= startTime) {
      violations.push({
        type: 'midnight_crossing',
        message: 'End time must be after start time on the same day'
      });
    }

    setBusinessHoursValidation({
      violations,
      warnings,
      isValid: violations.length === 0
    });
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
    
    // Clear error when user makes changes
    if (error) setError('');
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

    if (!computedValues?.isValidRange) {
      setError('End time must be after start time');
      return false;
    }

    if (computedValues?.isPast) {
      setError('Cannot schedule ice time in the past');
      return false;
    }

    if (businessHoursValidation && !businessHoursValidation.isValid) {
      setError(businessHoursValidation.violations[0]?.message || 'Time validation failed');
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
      
      const repeatEndDateTime = dateUtils.createFacilityDateTime(
        formData.repeat_end_date,
        '23:59',
        facilityTimezone
      );
      
      if (repeatEndDateTime <= computedValues.facilityStartDateTime) {
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
      
      // Prepare event data with UTC times
      const eventData = {
        resource_id: parseInt(formData.resource_id),
        // Send UTC times to backend
        event_start_date_time: computedValues.utcStartDateTime,
        event_end_date_time: computedValues.utcEndDateTime,
        episode_duration: parseInt(formData.episode_duration),
        repeat_mode: formData.repeat_mode,
        generate_episodes: formData.generate_episodes,
        facility_timezone: facilityTimezone
      };
      
      console.log('Submitting event data:', eventData);
      
      // Add recurring event data if applicable
      if (formData.repeat_mode !== 'once') {
        eventData.repeat_end_date = formData.repeat_end_date;
        if (formData.repeat_mode === 'weekly') {
          eventData.repeat_days = formData.repeat_days;
        }
      }
      
      // Add episode data
      if (formData.generate_episodes) {
        const selectedResourceData = resources.find(r => r.resource_id === parseInt(formData.resource_id));
        eventData.episode_data = {
          episode_title: formData.episode_title || `Ice Time - ${selectedResourceData?.resource_name}`,
          episode_description: formData.episode_description,
          episode_price: parseFloat(formData.episode_price)
        };
      }
      
      const result = await calendarService.createEvent(eventData, facilityTimezone);
      
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
    // Calculate default times for reset
    const defaultTimes = calculateSmartDefaultTimes(null, facility);
    
    setFormData({
      resource_id: '',
      event_date: '',
      start_time: defaultTimes.startTime,
      end_time: defaultTimes.endTime,
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
    setBusinessHoursValidation(null);
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
            {/* Timezone Information Panel */}
            {timezoneInfo && (
              <div className="timezone-info-panel">
                <div className="timezone-header">
                  <span className="timezone-icon">🌍</span>
                  <div className="timezone-details">
                    <div className="timezone-name">{facility.facility_name}</div>
                    <div className="timezone-current">
                      {timezoneInfo.currentTime}
                    </div>
                  </div>
                </div>
                <div className="business-hours">
                  <span className="business-hours-label">Business Hours:</span>
                  <span className="business-hours-time">
                    {timezoneInfo.businessHours.start.slice(0, 5)} - {timezoneInfo.businessHours.end.slice(0, 5)}
                  </span>
                </div>
              </div>
            )}

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
                    min={dateUtils.extractDateString(new Date(), facilityTimezone)}
                  />
                </div>

                <div className="form-group">
                  <label>Start Time * ({timezoneInfo?.displayName})</label>
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
                  <label>End Time * ({timezoneInfo?.displayName})</label>
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

              {/* Time Preview */}
              {computedValues && (
                <div className="time-preview">
                  <div className="preview-header">
                    <span className="preview-icon">⏰</span>
                    <span className="preview-label">Schedule Preview</span>
                  </div>
                  <div className="preview-details">
                    <div className="preview-time">
                      {computedValues.displayStart} - {computedValues.displayEnd}
                    </div>
                    <div className="preview-duration">
                      Duration: {dateUtils.formatDuration(computedValues.duration)}
                    </div>
                    {computedValues.isPast && (
                      <div className="preview-warning">⚠️ This time is in the past</div>
                    )}
                  </div>
                </div>
              )}

              {/* Business Hours Validation */}
              {businessHoursValidation && (
                <div className="validation-panel">
                  {businessHoursValidation.violations.map((violation, index) => (
                    <div key={index} className="validation-error">
                      <span className="validation-icon">❌</span>
                      <span className="validation-message">{violation.message}</span>
                    </div>
                  ))}
                  {businessHoursValidation.warnings.map((warning, index) => (
                    <div key={index} className="validation-warning">
                      <span className="validation-icon">⚠️</span>
                      <span className="validation-message">{warning.message}</span>
                    </div>
                  ))}
                </div>
              )}

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
              disabled={loading || (businessHoursValidation && !businessHoursValidation.isValid)}
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