const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Booking = sequelize.define('Booking', {
  booking_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  episode_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'episode',
      key: 'episode_id'
    }
  },
  program_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'program',
      key: 'program_id'
    }
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'user',
      key: 'user_id'
    }
  },
  booking_status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending',
    allowNull: false,
    validate: {
      isIn: [['pending', 'approved', 'rejected', 'cancelled']]
    }
  },
  booking_notes: {
    type: DataTypes.TEXT
  },
  admin_notes: {
    type: DataTypes.TEXT
  },
  approved_by_user_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'user',
      key: 'user_id'
    }
  },
  approved_ts: {
    type: DataTypes.DATE
  },
  created_by: {
    type: DataTypes.STRING(30)
  },
  updated_by: {
    type: DataTypes.STRING(30)
  }
}, {
  tableName: 'booking',
  timestamps: true,
  createdAt: 'create_ts',
  updatedAt: 'update_ts'
});

// Instance methods
Booking.prototype.canBeApproved = function() {
  return this.booking_status === 'pending';
};

Booking.prototype.canBeCancelled = function() {
  return ['pending', 'approved'].includes(this.booking_status);
};

// Associations
Booking.associate = function(models) {
  Booking.belongsTo(models.Episode, {
    foreignKey: 'episode_id',
    as: 'episode'
  });
  
  Booking.belongsTo(models.Program, {
    foreignKey: 'program_id',
    as: 'program'
  });
  
  Booking.belongsTo(models.User, {
    foreignKey: 'user_id',
    as: 'user'
  });
  
  Booking.belongsTo(models.User, {
    foreignKey: 'approved_by_user_id',
    as: 'approvedBy'
  });
};

module.exports = Booking;