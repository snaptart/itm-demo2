// backend/src/models/Program.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Program = sequelize.define('Program', {
  program_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  program_admin_user_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'user',
      key: 'user_id'
    }
  },
  program_type_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'program_type',
      key: 'program_type_id'
    }
  },
  program_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  program_color: {
    type: DataTypes.STRING(20),
    defaultValue: '#4299e1'
  },
  scheduler_user_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'user',
      key: 'user_id'
    }
  },
  created_by: {
    type: DataTypes.STRING(30)
  },
  updated_by: {
    type: DataTypes.STRING(30)
  }
}, {
  tableName: 'program',
  timestamps: true,
  createdAt: 'create_ts',
  updatedAt: 'update_ts'
});

// Instance methods
Program.prototype.getDisplayName = function() {
  return this.program_name;
};

Program.prototype.canBeDeleted = async function() {
  // Check if program has any episodes assigned
  const Episode = require('./Episode');
  const episodeCount = await Episode.count({
    where: {
      [sequelize.Sequelize.Op.or]: [
        { program_id: this.program_id },
        { assigned_to_program_id: this.program_id }
      ]
    }
  });
  
  return episodeCount === 0;
};

// Associations
Program.associate = function(models) {
  Program.belongsTo(models.ProgramType, {
    foreignKey: 'program_type_id',
    as: 'programType'
  });
  
  Program.belongsTo(models.User, {
    foreignKey: 'scheduler_user_id',
    as: 'scheduler'
  });
  
  Program.belongsTo(models.User, {
    foreignKey: 'program_admin_user_id',
    as: 'admin'
  });
  
  Program.hasMany(models.Episode, {
    foreignKey: 'program_id',
    as: 'episodes'
  });
  
  Program.hasMany(models.Episode, {
    foreignKey: 'assigned_to_program_id',
    as: 'assignedEpisodes'
  });
  
  Program.hasMany(models.Booking, {
    foreignKey: 'program_id',
    as: 'bookings'
  });
};

module.exports = Program;