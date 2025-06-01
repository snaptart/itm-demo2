const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ResourceType = sequelize.define('ResourceType', {
  resource_type_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  resource_type_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  resource_type_desc: {
    type: DataTypes.TEXT
  },
  created_by: {
    type: DataTypes.STRING(30)
  },
  updated_by: {
    type: DataTypes.STRING(30)
  }
}, {
  tableName: 'resource_type',
  timestamps: true,
  createdAt: 'create_ts',
  updatedAt: 'update_ts',
  underscored: true
});

// Associations
ResourceType.associate = function(models) {
  ResourceType.hasMany(models.Resource, {
    foreignKey: 'resource_type_id',
    as: 'resources'
  });
};

module.exports = ResourceType;