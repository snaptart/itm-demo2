// backend/src/models/Episode.js (Simplified - Local Time Storage)
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
  // Store times in facility local timezone
  episode_start_date_time: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'Stored in facility local time'
  },
  episode_end_date_time: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'Stored in facility local time'
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

// Simple instance methods without timezone conversion
Episode.prototype.getStatusColor = function() {
  const statusColors = {
    'available': '#FFFFFF',
    'assigned': '#FFEB3B',
    'pending': '#FFEB3B',
    'booked': '#4CAF50',
    'maintenance': '#9E9E9E',
    'cancelled': '#9E9E9E'
  };
  
  // Admin view special case
  if (this.episode_status === 'assigned' && this.assigned_to_program_id) {
    return '#2196F3';
  }
  
  return statusColors[this.episode_status] || '#FFFFFF';
};

Episode.prototype.canBeBooked = function() {
  return ['available', 'assigned'].includes(this.episode_status);
};

Episode.prototype.getFormattedPrice = function() {
  return this.episode_price ? `$${parseFloat(this.episode_price).toFixed(2)}` : 'N/A';
};

Episode.prototype.getDuration = function() {
  if (this.episode_duration) {
    return this.episode_duration;
  }
  
  const start = new Date(this.episode_start_date_time);
  const end = new Date(this.episode_end_date_time);
  return Math.round((end - start) / (1000 * 60));
};

Episode.prototype.isPastEpisode = function() {
  return new Date(this.episode_start_date_time) < new Date();
};

Episode.prototype.canBeEdited = function(user) {
  if (!user) return false;
  
  // Only admins can edit for now
  if (user.user_type !== 'admin') return false;
  
  // Cannot edit past episodes
  if (this.isPastEpisode()) return false;
  
  // Cannot edit booked episodes
  if (this.episode_status === 'booked') return false;
  
  return true;
};

// Validate against business hours (simplified)
Episode.prototype.validateBusinessHours = function(facility) {
  const violations = [];
  const warnings = [];
  
  if (!facility) {
    violations.push('Facility information not available');
    return { violations, warnings };
  }
  
  const episodeStart = new Date(this.episode_start_date_time);
  const episodeEnd = new Date(this.episode_end_date_time);
  
  const startTimeStr = episodeStart.toTimeString().slice(0, 5);
  const endTimeStr = episodeEnd.toTimeString().slice(0, 5);
  
  // Check against facility hours
  if (facility.facility_daily_start_time && facility.facility_daily_end_time) {
    const businessStart = facility.facility_daily_start_time.slice(0, 5);
    const businessEnd = facility.facility_daily_end_time.slice(0, 5);
    
    if (startTimeStr < businessStart || endTimeStr > businessEnd) {
      violations.push(`Episode time (${startTimeStr} - ${endTimeStr}) is outside business hours (${businessStart} - ${businessEnd})`);
    }
  }
  
  // Check for unusual hours
  const startHour = episodeStart.getHours();
  const endHour = episodeEnd.getHours();
  
  if (startHour < 6 || endHour > 22) {
    warnings.push('Episode is scheduled outside typical arena operating hours');
  }
  
  return { violations, warnings };
};

// Check for conflicts
Episode.prototype.checkConflictsWith = function(otherEpisode) {
  if (!otherEpisode || this.episode_id === otherEpisode.episode_id) return false;
  
  const thisStart = new Date(this.episode_start_date_time);
  const thisEnd = new Date(this.episode_end_date_time);
  const otherStart = new Date(otherEpisode.episode_start_date_time);
  const otherEnd = new Date(otherEpisode.episode_end_date_time);
  
  // Check for overlap
  return thisStart < otherEnd && otherStart < thisEnd;
};

// Associations
Episode.associate = function(models) {
  console.log('Setting up Episode associations...');
  
  if (models.Event) {
    Episode.belongsTo(models.Event, {
      foreignKey: 'event_id',
      as: 'event'
    });
  }
  
  if (models.Program) {
    Episode.belongsTo(models.Program, {
      foreignKey: 'program_id',
      as: 'program'
    });
    
    Episode.belongsTo(models.Program, {
      foreignKey: 'assigned_to_program_id',
      as: 'assignedProgram'
    });
  }
  
  if (models.Booking) {
    Episode.hasMany(models.Booking, {
      foreignKey: 'episode_id',
      as: 'bookings'
    });
  }
};

module.exports = Episode;