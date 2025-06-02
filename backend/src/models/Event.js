// backend/src/models/Event.js (Simplified - Local Time Storage)
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

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
    type: DataTypes.DATEONLY
  },
  event_start_time: {
    type: DataTypes.TIME
  },
  event_end_date: {
    type: DataTypes.DATEONLY
  },
  event_end_time: {
    type: DataTypes.TIME
  },
  // Store times in facility local timezone
  event_start_date_time: {
    type: DataTypes.DATE,
    comment: 'Stored in facility local time'
  },
  event_end_date_time: {
    type: DataTypes.DATE,
    comment: 'Stored in facility local time'
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

// Simple instance methods without timezone conversion
Event.prototype.getDuration = function() {
  if (!this.event_start_date_time || !this.event_end_date_time) return 0;
  return Math.round((new Date(this.event_end_date_time) - new Date(this.event_start_date_time)) / (1000 * 60));
};

Event.prototype.isRecurring = function() {
  return this.repeat_mode && this.repeat_mode !== 'once';
};

Event.prototype.isPastEvent = function() {
  return new Date(this.event_start_date_time) < new Date();
};

Event.prototype.getExpectedEpisodeCount = function() {
  if (!this.episode_duration || this.episode_duration <= 0) return 0;
  const totalDuration = this.getDuration();
  return Math.floor(totalDuration / this.episode_duration);
};

// Validation without timezone complexity
Event.prototype.validateAgainstFacility = function(facility) {
  const violations = [];
  const warnings = [];
  
  if (!facility) {
    violations.push('Facility information not available for validation');
    return { violations, warnings };
  }
  
  const eventStart = new Date(this.event_start_date_time);
  const eventEnd = new Date(this.event_end_date_time);
  
  if (!eventStart || !eventEnd || isNaN(eventStart.getTime()) || isNaN(eventEnd.getTime())) {
    violations.push('Invalid event times');
    return { violations, warnings };
  }
  
  // Check against facility operating hours
  if (facility.facility_daily_start_time && facility.facility_daily_end_time) {
    const eventStartTime = eventStart.toTimeString().slice(0, 5);
    const eventEndTime = eventEnd.toTimeString().slice(0, 5);
    const operatingStart = facility.facility_daily_start_time.slice(0, 5);
    const operatingEnd = facility.facility_daily_end_time.slice(0, 5);
    
    if (eventStartTime < operatingStart || eventEndTime > operatingEnd) {
      violations.push(`Event time (${eventStartTime} - ${eventEndTime}) is outside facility operating hours (${operatingStart} - ${operatingEnd})`);
    }
  }
  
  // Check duration constraints
  const duration = this.getDuration();
  
  if (facility.min_booking_duration && duration < facility.min_booking_duration) {
    violations.push(`Event duration (${duration} min) is less than facility minimum (${facility.min_booking_duration} min)`);
  }
  
  if (facility.max_booking_duration && duration > facility.max_booking_duration) {
    violations.push(`Event duration (${duration} min) exceeds facility maximum (${facility.max_booking_duration} min)`);
  }
  
  return { violations, warnings };
};

// Check for conflicts
Event.prototype.checkConflictsWith = function(otherEvent) {
  if (!otherEvent || this.event_id === otherEvent.event_id) return false;
  if (this.resource_id !== otherEvent.resource_id) return false;
  
  const thisStart = new Date(this.event_start_date_time);
  const thisEnd = new Date(this.event_end_date_time);
  const otherStart = new Date(otherEvent.event_start_date_time);
  const otherEnd = new Date(otherEvent.event_end_date_time);
  
  // Check for overlap
  return thisStart < otherEnd && otherStart < thisEnd;
};

// Hook to update legacy date/time fields
Event.addHook('beforeSave', (event, options) => {
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
});

// Associations
Event.associate = function(models) {
  console.log('Setting up Event associations...');
  
  if (models.Resource) {
    Event.belongsTo(models.Resource, {
      foreignKey: 'resource_id',
      as: 'resource'
    });
  }
  
  if (models.Episode) {
    Event.hasMany(models.Episode, {
      foreignKey: 'event_id',
      as: 'episodes'
    });
  }
  
  // Self-referencing
  Event.belongsTo(Event, {
    foreignKey: 'parent_event_id',
    as: 'parentEvent'
  });
  
  Event.hasMany(Event, {
    foreignKey: 'parent_event_id',
    as: 'childEvents'
  });
};

module.exports = Event;