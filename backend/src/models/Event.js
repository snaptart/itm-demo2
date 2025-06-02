// backend/src/models/Event.js (Fixed V2 - Using Custom Type)
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { TIMESTAMP_NO_TZ } = require('../config/database');

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
  // Use custom type that doesn't convert timezone
  event_start_date_time: {
    type: TIMESTAMP_NO_TZ,
    comment: 'Stored in facility local time'
  },
  event_end_date_time: {
    type: TIMESTAMP_NO_TZ,
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
    type: TIMESTAMP_NO_TZ
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

// Hook to update legacy date/time fields
Event.addHook('beforeSave', (event, options) => {
  // Extract from the datetime values that will be saved
  const startDateTime = event.event_start_date_time;
  const endDateTime = event.event_end_date_time;
  
  if (startDateTime) {
    let dateStr = startDateTime;
    
    // Convert to string if needed
    if (startDateTime instanceof Date) {
      const year = startDateTime.getFullYear();
      const month = String(startDateTime.getMonth() + 1).padStart(2, '0');
      const day = String(startDateTime.getDate()).padStart(2, '0');
      const hours = String(startDateTime.getHours()).padStart(2, '0');
      const minutes = String(startDateTime.getMinutes()).padStart(2, '0');
      const seconds = String(startDateTime.getSeconds()).padStart(2, '0');
      
      dateStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      event.event_start_time = `${hours}:${minutes}:${seconds}`;
      event.event_start_date = `${year}-${month}-${day}`;
    } else if (typeof dateStr === 'string') {
      // Extract from string
      const dateMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
      const timeMatch = dateStr.match(/(\d{2}):(\d{2}):(\d{2})/);
      
      if (dateMatch) {
        event.event_start_date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
      }
      
      if (timeMatch) {
        event.event_start_time = `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`;
      }
    }
  }
  
  // Same for end time
  if (endDateTime) {
    let dateStr = endDateTime;
    
    // Convert to string if needed
    if (endDateTime instanceof Date) {
      const year = endDateTime.getFullYear();
      const month = String(endDateTime.getMonth() + 1).padStart(2, '0');
      const day = String(endDateTime.getDate()).padStart(2, '0');
      const hours = String(endDateTime.getHours()).padStart(2, '0');
      const minutes = String(endDateTime.getMinutes()).padStart(2, '0');
      const seconds = String(endDateTime.getSeconds()).padStart(2, '0');
      
      dateStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      event.event_end_time = `${hours}:${minutes}:${seconds}`;
      event.event_end_date = `${year}-${month}-${day}`;
    } else if (typeof dateStr === 'string') {
      // Extract from string
      const dateMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
      const timeMatch = dateStr.match(/(\d{2}):(\d{2}):(\d{2})/);
      
      if (dateMatch) {
        event.event_end_date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
      }
      
      if (timeMatch) {
        event.event_end_time = `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`;
      }
    }
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