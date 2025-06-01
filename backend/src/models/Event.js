// backend/src/models/Event.js (Fixed associations with defensive checks)
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Import timezone utilities with fallback
let TimezoneUtils;
try {
  TimezoneUtils = require('../utils/timezoneUtils');
} catch (error) {
  console.warn('TimezoneUtils not available in Event model, using fallback');
  TimezoneUtils = {
    DEFAULT_TIMEZONE: 'America/Chicago',
    convertToFacilityTime: (dateTime, timezone) => new Date(dateTime),
    formatForDisplay: (dateTime, timezone) => new Date(dateTime).toLocaleString(),
    calculateDurationWithDST: (start, end, timezone) => Math.round((new Date(end) - new Date(start)) / (1000 * 60))
  };
}

const Event = sequelize.define('Event', {
  event_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  resource_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'resource',
      key: 'resource_id'
    }
  },
  all_day: {
    type: DataTypes.STRING(11)
  },
  event_start_date: {
    type: DataTypes.DATEONLY,
    comment: 'Legacy field - extracted from UTC datetime'
  },
  event_start_time: {
    type: DataTypes.TIME,
    comment: 'Legacy field - extracted from UTC datetime'
  },
  event_end_date: {
    type: DataTypes.DATEONLY,
    comment: 'Legacy field - extracted from UTC datetime'
  },
  event_end_time: {
    type: DataTypes.TIME,
    comment: 'Legacy field - extracted from UTC datetime'
  },
  // IMPORTANT: These are the primary datetime fields, stored as UTC
  event_start_date_time: {
    type: DataTypes.DATE,
    comment: 'Primary start time - stored as UTC, convert to facility timezone for display'
  },
  event_end_date_time: {
    type: DataTypes.DATE,
    comment: 'Primary end time - stored as UTC, convert to facility timezone for display'
  },
  repeat_mode: {
    type: DataTypes.STRING(10),
    defaultValue: 'once'
  },
  repeat_ends: {
    type: DataTypes.STRING(30)
  },
  num_occurrences: {
    type: DataTypes.INTEGER
  },
  event_dates: {
    type: DataTypes.TEXT
  },
  episode_duration: {
    type: DataTypes.INTEGER,
    comment: 'Duration in minutes for generated episodes'
  },
  maintenance_interval: {
    type: DataTypes.INTEGER
  },
  event_last_date_time: {
    type: DataTypes.DATE
  },
  num_conflicts: {
    type: DataTypes.INTEGER
  },
  recurrence_pattern_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'recurrence_pattern',
      key: 'pattern_id'
    }
  },
  is_recurring_master: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  parent_event_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'event',
      key: 'event_id'
    }
  },
  created_by: {
    type: DataTypes.STRING(30)
  },
  updated_by: {
    type: DataTypes.STRING(30)
  }
}, {
  tableName: 'event',
  timestamps: true,
  createdAt: 'create_ts',
  updatedAt: 'update_ts'
});

// ENHANCED: Timezone-aware instance methods
Event.prototype.getFacilityStartTime = function(facilityTimezone = TimezoneUtils.DEFAULT_TIMEZONE) {
  if (!this.event_start_date_time) return null;
  
  try {
    return TimezoneUtils.convertToFacilityTime(this.event_start_date_time, facilityTimezone);
  } catch (error) {
    console.error('Failed to convert event start time to facility timezone:', error);
    return new Date(this.event_start_date_time);
  }
};

Event.prototype.getFacilityEndTime = function(facilityTimezone = TimezoneUtils.DEFAULT_TIMEZONE) {
  if (!this.event_end_date_time) return null;
  
  try {
    return TimezoneUtils.convertToFacilityTime(this.event_end_date_time, facilityTimezone);
  } catch (error) {
    console.error('Failed to convert event end time to facility timezone:', error);
    return new Date(this.event_end_date_time);
  }
};

Event.prototype.getFormattedTimeRange = function(facilityTimezone = TimezoneUtils.DEFAULT_TIMEZONE) {
  try {
    const facilityStart = this.getFacilityStartTime(facilityTimezone);
    const facilityEnd = this.getFacilityEndTime(facilityTimezone);
    
    if (!facilityStart || !facilityEnd) return 'Invalid time range';
    
    const startStr = facilityStart.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: facilityTimezone
    });
    
    const endStr = facilityEnd.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: facilityTimezone
    });
    
    return `${startStr} - ${endStr}`;
  } catch (error) {
    console.error('Failed to format event time range:', error);
    return 'Invalid time range';
  }
};

Event.prototype.getDurationInFacilityTimezone = function(facilityTimezone = TimezoneUtils.DEFAULT_TIMEZONE) {
  try {
    return TimezoneUtils.calculateDurationWithDST(
      this.event_start_date_time,
      this.event_end_date_time,
      facilityTimezone
    );
  } catch (error) {
    console.error('Failed to calculate event duration with DST:', error);
    return Math.round((new Date(this.event_end_date_time) - new Date(this.event_start_date_time)) / (1000 * 60));
  }
};

Event.prototype.isRecurring = function() {
  return this.repeat_mode && this.repeat_mode !== 'once';
};

Event.prototype.isPastEvent = function(facilityTimezone = TimezoneUtils.DEFAULT_TIMEZONE) {
  try {
    const facilityStart = this.getFacilityStartTime(facilityTimezone);
    const now = new Date();
    return facilityStart < now;
  } catch (error) {
    console.error('Failed to check if event is past:', error);
    return new Date(this.event_start_date_time) < new Date();
  }
};

// ENHANCED: Method to get expected number of episodes for this event
Event.prototype.getExpectedEpisodeCount = function() {
  if (!this.episode_duration || this.episode_duration <= 0) return 0;
  
  try {
    const totalDuration = this.getDurationInFacilityTimezone();
    return Math.floor(totalDuration / this.episode_duration);
  } catch (error) {
    console.error('Failed to calculate expected episode count:', error);
    return 0;
  }
};

// ENHANCED: Method to validate event times against facility constraints
Event.prototype.validateAgainstFacility = function(facility) {
  const violations = [];
  const warnings = [];
  
  if (!facility) {
    violations.push('Facility information not available for validation');
    return { violations, warnings };
  }
  
  try {
    const facilityTimezone = facility.facility_time_zone || TimezoneUtils.DEFAULT_TIMEZONE;
    const facilityStart = this.getFacilityStartTime(facilityTimezone);
    const facilityEnd = this.getFacilityEndTime(facilityTimezone);
    
    if (!facilityStart || !facilityEnd) {
      violations.push('Invalid event times');
      return { violations, warnings };
    }
    
    // Check against facility operating hours
    if (facility.facility_daily_start_time && facility.facility_daily_end_time) {
      const facilityStartTimeStr = facilityStart.toTimeString().slice(0, 5);
      const facilityEndTimeStr = facilityEnd.toTimeString().slice(0, 5);
      const operatingStart = facility.facility_daily_start_time.slice(0, 5);
      const operatingEnd = facility.facility_daily_end_time.slice(0, 5);
      
      if (facilityStartTimeStr < operatingStart || facilityEndTimeStr > operatingEnd) {
        violations.push(`Event time (${facilityStartTimeStr} - ${facilityEndTimeStr}) is outside facility operating hours (${operatingStart} - ${operatingEnd})`);
      }
    }
    
    // Check minimum and maximum duration constraints
    const duration = this.getDurationInFacilityTimezone(facilityTimezone);
    
    if (facility.min_booking_duration && duration < facility.min_booking_duration) {
      violations.push(`Event duration (${duration} min) is less than facility minimum (${facility.min_booking_duration} min)`);
    }
    
    if (facility.max_booking_duration && duration > facility.max_booking_duration) {
      violations.push(`Event duration (${duration} min) exceeds facility maximum (${facility.max_booking_duration} min)`);
    }
    
    // Check episode duration constraints
    if (this.episode_duration) {
      if (facility.min_booking_duration && this.episode_duration < facility.min_booking_duration) {
        warnings.push(`Episode duration (${this.episode_duration} min) is less than facility minimum (${facility.min_booking_duration} min)`);
      }
      
      if (this.episode_duration > duration) {
        violations.push(`Episode duration (${this.episode_duration} min) cannot exceed event duration (${duration} min)`);
      }
    }
    
  } catch (error) {
    console.error('Event facility validation error:', error);
    violations.push('Unable to validate against facility constraints');
  }
  
  return { violations, warnings };
};

// ENHANCED: Method to check for conflicts with other events on the same resource
Event.prototype.checkConflictsWith = function(otherEvent) {
  try {
    if (!otherEvent || this.event_id === otherEvent.event_id) return false;
    if (this.resource_id !== otherEvent.resource_id) return false;
    
    // Use UTC times for accurate conflict detection
    const thisStart = new Date(this.event_start_date_time);
    const thisEnd = new Date(this.event_end_date_time);
    const otherStart = new Date(otherEvent.event_start_date_time);
    const otherEnd = new Date(otherEvent.event_end_date_time);
    
    // Check for overlap: (StartA < EndB) && (StartB < EndA)
    return thisStart < otherEnd && otherStart < thisEnd;
  } catch (error) {
    console.error('Event conflict check error:', error);
    return false;
  }
};

// FIXED: Override toJSON to preserve UTC times for API consistency
Event.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  
  // Keep UTC times as-is for consistent API behavior
  // Controllers will handle timezone conversion as needed
  return values;
};

// ENHANCED: Method to get event data formatted for a specific timezone
Event.prototype.toFacilityJSON = function(facilityTimezone = TimezoneUtils.DEFAULT_TIMEZONE) {
  const values = Object.assign({}, this.get());
  
  try {
    // Convert UTC times to facility timezone for display
    const facilityStart = this.getFacilityStartTime(facilityTimezone);
    const facilityEnd = this.getFacilityEndTime(facilityTimezone);
    
    if (facilityStart && facilityEnd) {
      values.event_start_date_time = facilityStart.toISOString();
      values.event_end_date_time = facilityEnd.toISOString();
      values.facility_timezone = facilityTimezone;
      values.formatted_time_range = this.getFormattedTimeRange(facilityTimezone);
      values.duration_with_dst = this.getDurationInFacilityTimezone(facilityTimezone);
      values.expected_episodes = this.getExpectedEpisodeCount();
    }
    
    // Add computed properties
    values.is_recurring = this.isRecurring();
    values.is_past = this.isPastEvent(facilityTimezone);
    
  } catch (error) {
    console.error('Failed to convert event to facility JSON:', error);
  }
  
  return values;
};

// ENHANCED: Static method to bulk convert events to facility timezone
Event.toFacilityJSONArray = function(events, facilityTimezone = TimezoneUtils.DEFAULT_TIMEZONE) {
  if (!Array.isArray(events)) return [];
  
  return events.map(event => {
    if (typeof event.toFacilityJSON === 'function') {
      return event.toFacilityJSON(facilityTimezone);
    } else {
      // Handle plain objects
      return {
        ...event,
        facility_timezone: facilityTimezone
      };
    }
  });
};

// ENHANCED: Hook to automatically update legacy date/time fields when UTC datetime changes
Event.addHook('beforeSave', (event, options) => {
  try {
    if (event.event_start_date_time) {
      const startDate = new Date(event.event_start_date_time);
      event.event_start_date = startDate.toISOString().split('T')[0];
      event.event_start_time = startDate.toTimeString().split(' ')[0];
    }
    
    if (event.event_end_date_time) {
      const endDate = new Date(event.event_end_date_time);
      event.event_end_date = endDate.toISOString().split('T')[0];
      event.event_end_time = endDate.toTimeString().split(' ')[0];
    }
  } catch (error) {
    console.error('Failed to update legacy date/time fields:', error);
    // Don't throw - let the save continue with the primary datetime fields
  }
});

// FIXED: Associations with defensive checks and detailed logging
Event.associate = function(models) {
  console.log('Setting up Event associations...');
  console.log('Available models:', Object.keys(models));
  
  try {
    // Resource association
    if (models.Resource) {
      Event.belongsTo(models.Resource, {
        foreignKey: 'resource_id',
        as: 'resource'
      });
      console.log('✓ Event -> Resource association created');
    } else {
      console.warn('⚠ Resource model not found for Event association');
    }
    
    // Episode association (this was causing the error)
    if (models.Episode) {
      Event.hasMany(models.Episode, {
        foreignKey: 'event_id',
        as: 'episodes'
      });
      console.log('✓ Event -> Episodes association created');
    } else {
      console.warn('⚠ Episode model not found for Event association');
    }
    
    // Self-referencing parent/child association
    Event.belongsTo(Event, {
      foreignKey: 'parent_event_id',
      as: 'parentEvent'
    });
    
    Event.hasMany(Event, {
      foreignKey: 'parent_event_id',
      as: 'childEvents'
    });
    console.log('✓ Event self-referencing associations created');
    
  } catch (error) {
    console.error('❌ Error in Event.associate:', error.message);
    throw error;
  }
};

module.exports = Event;