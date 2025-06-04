const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProgramType = sequelize.define('ProgramType', {
  program_type_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  program_type_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  program_type_desc: {
    type: DataTypes.TEXT
  },
  created_by: {
    type: DataTypes.STRING(30)
  },
  updated_by: {
    type: DataTypes.STRING(30)
  }
}, {
  tableName: 'program_type',
  timestamps: true,
  createdAt: 'create_ts',
  updatedAt: 'update_ts'
});

// Associations
ProgramType.associate = function(models) {
  ProgramType.hasMany(models.Program, {
    foreignKey: 'program_type_id',
    as: 'programs'
  });
};

module.exports = ProgramType;