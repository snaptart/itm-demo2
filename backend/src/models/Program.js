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
    type: DataTypes.STRING(20)
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

// Associations
Program.associate = function(models) {
  Program.belongsTo(models.User, {
    foreignKey: 'program_admin_user_id',
    as: 'adminUser'
  });
  
  Program.belongsTo(models.User, {
    foreignKey: 'scheduler_user_id',
    as: 'schedulerUser'
  });
  
  Program.belongsTo(models.ProgramType, {
    foreignKey: 'program_type_id',
    as: 'programType'
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