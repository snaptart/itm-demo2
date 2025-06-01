// backend/src/models/Episode.js (Enhanced with Timezone Handling)
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Import timezone utilities with fallback
let TimezoneUtils;
try {
  TimezoneUtils = require('../utils/timezoneUtils');
} catch (error) {
  console.warn('TimezoneUtils not available in Episode model, using fallback');
  TimezoneUtils = {
    DEFAULT_TIMEZONE: 'America/Chicago',
    convertToFacilityTime: (dateTime, timezone) => new Date(dateTime),
    formatForDisplay: (dateTime, timezone) => new Date(dateTime).toLocaleString(),
    calculateDurationWithDST: (start, end, timezone) => Math.round((new Date(end) - new Date(start)) / (1000 * 60))
  };
}

const Episode = sequelize.define('Episode', {
  episode_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  event_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'event',
      key: 'event_id'
    }
  },
  schedule_id: {
    type: DataTypes.INTEGER
  },
  program_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'program',
      key: 'program_id'
    }
  },
  team_id: {
    type: DataTypes.INTEGER
  },
  episode_seq_no: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // IMPORTANT: These are stored as UTC in the database
  episode_start_date_time: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'Stored as UTC, convert to facility timezone for display'
  },
  episode_end_date_time: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'Stored as UTC, convert to facility timezone for display'
  },
  episode_duration: {
    type: DataTypes.INTEGER,
    comment: 'Duration in minutes'
  },
  episode_title: {
    type: DataTypes.STRING(100)
  },
  episode_description: {
    type: DataTypes.TEXT
  },
  episode_url: {
    type: DataTypes.STRING(200)
  },
  episode_color: {
    type: DataTypes.STRING(20)
  },
  episode_price: {
    type: DataTypes.DECIMAL(10, 2)
  },
  episode_status: {
    type: DataTypes.STRING(20),
    defaultValue: 'available',
    validate: {
      isIn: [['available', 'assigned', 'pending', 'booked', 'cancelled', 'maintenance']]
    }
  },
  is_recurring: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  assigned_to_program_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'program',
      key: 'program_id'
    }
  },
  created_by: {
    type: DataTypes.STRING(30)
  },
  updated_by: {
    type: DataTypes.STRING(30)
  }
}, {
  tableName: 'episode',
  timestamps: true,
  createdAt: 'create_ts',
  updatedAt: 'update_ts'
});

// ENHANCED: Timezone-aware instance methods
Episode.prototype.getStatusColor = function() {
  const statusColors = {
    'available': '#FFFFFF',      // White: Unassigned
    'assigned': '#FFEB3B',       // Yellow: Assigned Pending
    'pending': '#FFEB3B',        // Yellow: Assigned Pending
    'booked': '#4CAF50',         // Green: Booked/Paid
    'maintenance': '#9E9E9E',    // Gray: Unavailable/Maintenance
    'cancelled': '#9E9E9E'       // Gray: Unavailable
  };
  
  // For admin view, assigned episodes that are reserved (not just pending) should be blue
  if (this.episode_status === 'assigned' && this.assigned_to_program_id) {
    return '#2196F3'; // Blue: Assigned Reserved
  }
  
  return statusColors[this.episode_status] || '#FFFFFF';
};

Episode.prototype.canBeBooked = function() {
  return ['available', 'assigned'].includes(this.episode_status);
};

Episode.prototype.getFormattedPrice = function() {
  return this.episode_price ? `${parseFloat(this.episode_price).toFixed(2)}` : 'N/A';
};

// FIXED: Timezone-aware time conversion methods
Episode.prototype.getFacilityStartTime = function(facilityTimezone = TimezoneUtils.DEFAULT_TIMEZONE) {
  if (!this.episode_start_date_time) return null;
  
  try {
    return TimezoneUtils.convertToFacilityTime(this.episode_start_date_time, facilityTimezone);
  } catch (error) {
    console.error('Failed to convert start time to facility timezone:', error);
    return new Date(this.episode_start_date_time);
  }
};

Episode.prototype.getFacilityEndTime = function(facilityTimezone = TimezoneUtils.DEFAULT_TIMEZONE) {
  if (!this.episode_end_date_time) return null;
  
  try {
    return TimezoneUtils.convertToFacilityTime(this.episode_end_date_time, facilityTimezone);
  } catch (error) {
    console.error('Failed to convert end time to facility timezone:', error);
    return new Date(this.episode_end_date_time);
  }
};

Episode.prototype.getFormattedTimeRange = function(facilityTimezone = TimezoneUtils.DEFAULT_TIMEZONE) {
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
    console.error('Failed to format time range:', error);
    return 'Invalid time range';
  }
};

Episode.prototype.getDurationInFacilityTimezone = function(facilityTimezone = TimezoneUtils.DEFAULT_TIMEZONE) {
  try {
    if (this.episode_duration) {
      return this.episode_duration;
    }
    
    return TimezoneUtils.calculateDurationWithDST(
      this.episode_start_date_time,
      this.episode_end_date_time,
      facilityTimezone
    );
  } catch (error) {
    console.error('Failed to calculate duration with DST:', error);
    return Math.round((new Date(this.episode_end_date_time) - new Date(this.episode_start_date_time)) / (1000 * 60));
  }
};

Episode.prototype.isPastEpisode = function(facilityTimezone = TimezoneUtils.DEFAULT_TIMEZONE) {
  try {
    const facilityStart = this.getFacilityStartTime(facilityTimezone);
    const now = new Date();
    return facilityStart < now;
  } catch (error) {
    console.error('Failed to check if episode is past:', error);
    return new Date(this.episode_start_date_time) < new Date();
  }
};

Episode.prototype.canBeEdited = function(user, facilityTimezone = TimezoneUtils.DEFAULT_TIMEZONE) {
  if (!user) return false;
  
  // Only admins can edit for now
  if (user.user_type !== 'admin') return false;
  
  // Cannot edit past episodes
  if (this.isPastEpisode(facilityTimezone)) return false;
  
  // Cannot edit booked episodes
  if (this.episode_status === 'booked') return false;
  
  // Cannot edit if it has active bookings (this would need to be checked with associations)
  return true;
};

// FIXED: Override toJSON to provide timezone-aware serialization
Episode.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  
  // Don't automatically convert times here - let the controller handle it
  // This preserves the UTC times for consistent API behavior
  return values;
};

// ENHANCED: Method to get episode data formatted for a specific timezone
Episode.prototype.toFacilityJSON = function(facilityTimezone = TimezoneUtils.DEFAULT_TIMEZONE) {
  const values = Object.assign({}, this.get());
  
  try {
    // Convert UTC times to facility timezone for display
    const facilityStart = this.getFacilityStartTime(facilityTimezone);
    const facilityEnd = this.getFacilityEndTime(facilityTimezone);
    
    if (facilityStart && facilityEnd) {
      values.episode_start_date_time = facilityStart.toISOString();
      values.episode_end_date_time = facilityEnd.toISOString();
      values.facility_timezone = facilityTimezone;
      values.formatted_time_range = this.getFormattedTimeRange(facilityTimezone);
      values.duration_with_dst = this.getDurationInFacilityTimezone(facilityTimezone);
    }
    
    // Add computed display properties
    values.status_color = this.getStatusColor();
    values.formatted_price = this.getFormattedPrice();
    values.can_be_booked = this.canBeBooked();
    values.is_past = this.isPastEpisode(facilityTimezone);
    
  } catch (error) {
    console.error('Failed to convert episode to facility JSON:', error);
  }
  
  return values;
};

// ENHANCED: Static method to bulk convert episodes to facility timezone
Episode.toFacilityJSONArray = function(episodes, facilityTimezone = TimezoneUtils.DEFAULT_TIMEZONE) {
  if (!Array.isArray(episodes)) return [];
  
  return episodes.map(episode => {
    if (typeof episode.toFacilityJSON === 'function') {
      return episode.toFacilityJSON(facilityTimezone);
    } else {
      // Handle plain objects
      return {
        ...episode,
        facility_timezone: facilityTimezone
      };
    }
  });
};

// ENHANCED: Method to validate episode times against facility business hours
Episode.prototype.validateAgainstBusinessHours = function(facilityBusinessHours, facilityTimezone = TimezoneUtils.DEFAULT_TIMEZONE) {
  const violations = [];
  const warnings = [];
  
  try {
    const facilityStart = this.getFacilityStartTime(facilityTimezone);
    const facilityEnd = this.getFacilityEndTime(facilityTimezone);
    
    if (!facilityStart || !facilityEnd) {
      violations.push('Invalid episode times');
      return { violations, warnings };
    }
    
    // Get day of week for facility timezone
    const dayOfWeek = facilityStart.getDay();
    const startTimeStr = facilityStart.toTimeString().slice(0, 5); // HH:MM
    const endTimeStr = facilityEnd.toTimeString().slice(0, 5); // HH:MM
    
    // Check against business hours if provided
    if (facilityBusinessHours) {
      const businessStart = facilityBusinessHours.start || '06:00';
      const businessEnd = facilityBusinessHours.end || '23:00';
      
      if (startTimeStr < businessStart || endTimeStr > businessEnd) {
        violations.push(`Episode time (${startTimeStr} - ${endTimeStr}) is outside business hours (${businessStart} - ${businessEnd})`);
      }
    }
    
    // Check for unusual hours
    const startHour = facilityStart.getHours();
    const endHour = facilityEnd.getHours();
    
    if (startHour < 6 || endHour > 22) {
      warnings.push('Episode is scheduled outside typical arena operating hours');
    }
    
  } catch (error) {
    console.error('Business hours validation error:', error);
    violations.push('Unable to validate business hours');
  }
  
  return { violations, warnings };
};

// ENHANCED: Method to check for conflicts with other episodes
Episode.prototype.checkConflictsWith = function(otherEpisode, facilityTimezone = TimezoneUtils.DEFAULT_TIMEZONE) {
  try {
    if (!otherEpisode || this.episode_id === otherEpisode.episode_id) return false;
    
    // Use UTC times for accurate conflict detection
    const thisStart = new Date(this.episode_start_date_time);
    const thisEnd = new Date(this.episode_end_date_time);
    const otherStart = new Date(otherEpisode.episode_start_date_time);
    const otherEnd = new Date(otherEpisode.episode_end_date_time);
    
    // Check for overlap: (StartA < EndB) && (StartB < EndA)
    return thisStart < otherEnd && otherStart < thisEnd;
  } catch (error) {
    console.error('Conflict check error:', error);
    return false;
  }
};

// Associations
Episode.associate = function(models) {
  Episode.belongsTo(models.Event, {
    foreignKey: 'event_id',
    as: 'event'
  });
  
  Episode.belongsTo(models.Program, {
    foreignKey: 'program_id',
    as: 'program'
  });
  
  Episode.belongsTo(models.Program, {
    foreignKey: 'assigned_to_program_id',
    as: 'assignedProgram'
  });
  
  Episode.hasMany(models.Booking, {
    foreignKey: 'episode_id',
    as: 'bookings'
  });
};