const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Resource = sequelize.define('Resource', {
  resource_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  facility_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'facility',
      key: 'facility_id'
    }
  },
  resource_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  resource_type_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'resource_type',
      key: 'resource_type_id'
    }
  },
  resource_status: {
    type: DataTypes.STRING(50),
    defaultValue: 'active',
    validate: {
      isIn: [['active', 'inactive', 'maintenance']]
    }
  },
  resource_desc: {
    type: DataTypes.STRING(255)
  },
  created_by: {
    type: DataTypes.STRING(30)
  },
  updated_by: {
    type: DataTypes.STRING(30)
  }
}, {
  tableName: 'resource',
  timestamps: true,
  createdAt: 'create_ts',
  updatedAt: 'update_ts',
  underscored: true
});

// Instance methods
Resource.prototype.isAvailable = function() {
  return this.resource_status === 'active';
};

// Associations
Resource.associate = function(models) {
  Resource.belongsTo(models.Facility, {
    foreignKey: 'facility_id',
    as: 'facility'
  });
  
  Resource.belongsTo(models.ResourceType, {
    foreignKey: 'resource_type_id',
    as: 'resourceType'
  });
  
  // TODO: Add this association when Event model is created
  // Resource.hasMany(models.Event, {
  //   foreignKey: 'resource_id',
  //   as: 'events'
  // });
};

module.exports = Resource;