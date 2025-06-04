// frontend/src/components/calendar/RequestIceTimeModal/RequestIceTimeModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { dateUtils } from '../../../utils/dateUtils';
import './RequestIceTimeModal.css';

function RequestIceTimeModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  selectedDate,
  selectedResource,
  facility,
  program,
  schedulerService,
  resourceService
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resources, setResources] = useState([]);
  const [businessHoursValidation, setBusinessHoursValidation] = useState(null);
  
  // Safety check for required props
  if (!isOpen || !facility || !program) {
    return null;
  }
  
  // Timezone for display only
  const facilityTimezone = facility.facility_time_zone || dateUtils.DEFAULT_TIMEZONE;
  const timezoneAbbr = dateUtils.getTimezoneDisplayName(facilityTimezone);
  
  // Helper function to calculate smart default times
  const calculateSmartDefaultTimes = (selectedDateInfo, facilityInfo) => {
    // If a specific time was clicked on the calendar, use it
    if (selectedDateInfo?.clickedTime && !selectedDateInfo.allDay) {
      const clickedDate = new Date(selectedDateInfo.clickedTime);
      const startTime = dateUtils.extractTimeString(clickedDate);
      
      // Calculate end time (1 hour later)
      const endDate = new Date(clickedDate);
      endDate.setHours(endDate.getHours() + 1);
      const endTime = dateUtils.extractTimeString(endDate);
      
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
    request_date: selectedDate ? dateUtils.extractDateString(selectedDate?.date || selectedDate) : '',
    start_time: defaultTimes.startTime,
    end_time: defaultTimes.endTime,
    request_notes: '',
    priority: 'normal'
  });

  // Computed values for display
  const computedValues = useMemo(() => {
    if (!formData.request_date || !formData.start_time || !formData.end_time) {
      return null;
    }

    try {
      // Create datetime objects
      const startDateTime = dateUtils.createDateTime(formData.request_date, formData.start_time);
      const endDateTime = dateUtils.createDateTime(formData.request_date, formData.end_time);

      if (!startDateTime || !endDateTime) {
        return null;
      }

      const duration = dateUtils.getDuration(startDateTime, endDateTime);
      const isValidRange = endDateTime > startDateTime;
      const isPast = dateUtils.isPast(startDateTime);
      
      return {
        startDateTime,
        endDateTime,
        duration,
        isValidRange,
        isPast,
        displayStart: dateUtils.formatForDisplay(startDateTime),
        displayEnd: dateUtils.formatTimeOnly(endDateTime)
      };
    } catch (error) {
      console.error('Error computing values:', error);
      return null;
    }
  }, [formData.request_date, formData.start_time, formData.end_time]);

  useEffect(() => {
    if (facility && isOpen) {
      loadResources();
    }
  }, [facility, isOpen]);

  useEffect(() => {
    if (selectedDate) {
      // Recalculate smart defaults when selected date changes
      const newDefaultTimes = calculateSmartDefaultTimes(selectedDate, facility);
      
      setFormData(prev => ({
        ...prev,
        request_date: dateUtils.extractDateString(selectedDate?.date || selectedDate),
        start_time: newDefaultTimes.startTime,
        end_time: newDefaultTimes.endTime
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

  // Validate business hours when time changes
  useEffect(() => {
    if (computedValues?.startDateTime && computedValues?.endDateTime) {
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

  const validateBusinessHours = () => {
    if (!computedValues) return;

    const startTime = formData.start_time;
    const endTime = formData.end_time;
    const businessStart = (facility.facility_daily_start_time || '06:00:00').slice(0, 5);
    const businessEnd = (facility.facility_daily_end_time || '23:00:00').slice(0, 5);

    const violations = [];
    const warnings = [];

    // Check if times are within business hours
    if (startTime < businessStart || endTime > businessEnd) {
      violations.push({
        type: 'business_hours',
        message: `Times must be between ${businessStart} - ${businessEnd}`
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
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user makes changes
    if (error) setError('');
  };

  const validateForm = () => {
    if (!formData.resource_id) {
      setError('Please select a rink');
      return false;
    }
    
    if (!formData.request_date) {
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
      setError('Cannot request ice time in the past');
      return false;
    }

    if (businessHoursValidation && !businessHoursValidation.isValid) {
      setError(businessHoursValidation.violations[0]?.message || 'Time validation failed');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }
    
    if (!schedulerService) {
      setError('Scheduler service not available');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // Prepare request data
      const requestData = {
        program_id: program.program_id,
        facility_id: facility.facility_id,
        resource_id: parseInt(formData.resource_id),
        requested_start_time: dateUtils.formatForAPI(computedValues.startDateTime),
        requested_end_time: dateUtils.formatForAPI(computedValues.endDateTime),
        request_notes: formData.request_notes.trim(),
        priority: formData.priority
      };
      
      console.log('Submitting ice time request:', requestData);
      
      const result = await schedulerService.requestIceTime(requestData);
      
      if (result.success) {
        onSuccess();
        handleClose();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to submit ice time request');
      console.error('Request ice time error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Calculate default times for reset
    const defaultTimes = calculateSmartDefaultTimes(null, facility);
    
    setFormData({
      resource_id: '',
      request_date: '',
      start_time: defaultTimes.startTime,
      end_time: defaultTimes.endTime,
      request_notes: '',
      priority: 'normal'
    });
    setError('');
    setBusinessHoursValidation(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content request-ice-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Request Ice Time</h2>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>

        {error && (
          <div className="modal-error">
            {error}
          </div>
        )}

        <div className="request-ice-form">
          <div className="modal-body">
            {/* Program & Facility Info */}
            <div className="request-info-panel">
              <div className="info-header">
                <span className="info-icon">📋</span>
                <div className="info-details">
                  <div className="program-name">Requesting for: {program.program_name}</div>
                  <div className="facility-name">At: {facility.facility_name}</div>
                </div>
              </div>
              <div className="timezone-info">
                All times in {timezoneAbbr} • Hours: {(facility.facility_daily_start_time || '06:00:00').slice(0, 5)} - {(facility.facility_daily_end_time || '23:00:00').slice(0, 5)}
              </div>
            </div>

            <div className="form-section">
              <h3>Request Details</h3>
              
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
                    name="request_date"
                    value={formData.request_date}
                    onChange={handleInputChange}
                    required
                    disabled={loading}
                    min={dateUtils.extractDateString(new Date())}
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

              {/* Time Preview */}
              {computedValues && (
                <div className="time-preview">
                  <div className="preview-header">
                    <span className="preview-icon">⏰</span>
                    <span className="preview-label">Request Preview</span>
                  </div>
                  <div className="preview-details">
                    <div className="preview-time">
                      {computedValues.displayStart} - {computedValues.displayEnd} {timezoneAbbr}
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

              <div className="form-group">
                <label>Priority</label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                  disabled={loading}
                >
                  <option value="low">Low Priority</option>
                  <option value="normal">Normal Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="form-group">
                <label>Notes (optional)</label>
                <textarea
                  name="request_notes"
                  value={formData.request_notes}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Add any special requests or notes for the arena administrator..."
                  disabled={loading}
                />
              </div>
            </div>

            <div className="request-help">
              <h4>What happens next?</h4>
              <ol>
                <li>Your request will be sent to {facility.facility_name}</li>
                <li>The arena administrator will review your request</li>
                <li>You'll be notified when they approve or assign the ice time</li>
                <li>Once approved, you can confirm your booking</li>
              </ol>
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
              {loading ? 'Submitting Request...' : 'Submit Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RequestIceTimeModal;