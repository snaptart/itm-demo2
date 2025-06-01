const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

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
  episode_start_date_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  episode_end_date_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  episode_duration: {
    type: DataTypes.INTEGER
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

// Instance methods
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
  return this.episode_price ? `$${parseFloat(this.episode_price).toFixed(2)}` : 'N/A';
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

module.exports = Episode;