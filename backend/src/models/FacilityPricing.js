const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FacilityPricing = sequelize.define('FacilityPricing', {
  pricing_id: {
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
  resource_type_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'resource_type',
      key: 'resource_type_id'
    }
  },
  program_type_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'program_type',
      key: 'program_type_id'
    }
  },
  day_of_week: {
    type: DataTypes.ARRAY(DataTypes.INTEGER)
  },
  start_time: {
    type: DataTypes.TIME
  },
  end_time: {
    type: DataTypes.TIME
  },
  base_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  prime_time_multiplier: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 1.0
  },
  weekend_multiplier: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 1.0
  },
  holiday_multiplier: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 1.5
  },
  effective_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  expiry_date: {
    type: DataTypes.DATEONLY
  },
  created_by: {
    type: DataTypes.STRING(30)
  }
}, {
  tableName: 'facility_pricing',
  timestamps: true,
  createdAt: 'create_ts',
  updatedAt: 'update_ts'
});

// Associations
FacilityPricing.associate = function(models) {
  FacilityPricing.belongsTo(models.Facility, {
    foreignKey: 'facility_id',
    as: 'facility'
  });
  
  FacilityPricing.belongsTo(models.ResourceType, {
    foreignKey: 'resource_type_id',
    as: 'resourceType'
  });
};

module.exports = FacilityPricing;