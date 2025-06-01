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
  event_start_date_time: {
    type: DataTypes.DATE
  },
  event_end_date_time: {
    type: DataTypes.DATE
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
    type: DataTypes.INTEGER
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

// Associations
Event.associate = function(models) {
  Event.belongsTo(models.Resource, {
    foreignKey: 'resource_id',
    as: 'resource'
  });
  
  Event.hasMany(models.Episode, {
    foreignKey: 'event_id',
    as: 'episodes'
  });
  
  Event.belongsTo(models.Event, {
    foreignKey: 'parent_event_id',
    as: 'parentEvent'
  });
  
  Event.hasMany(models.Event, {
    foreignKey: 'parent_event_id',
    as: 'childEvents'
  });
};

module.exports = Event;