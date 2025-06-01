const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Facility = sequelize.define('Facility', {
  facility_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  org_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  location_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  facility_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  facility_address_1: {
    type: DataTypes.STRING(100)
  },
  facility_address_2: {
    type: DataTypes.STRING(100)
  },
  facility_city: {
    type: DataTypes.STRING(50)
  },
  facility_state: {
    type: DataTypes.STRING(50)
  },
  facility_postal_code: {
    type: DataTypes.STRING(20)
  },
  facility_country: {
    type: DataTypes.STRING(50),
    defaultValue: 'USA'
  },
  facility_time_zone: {
    type: DataTypes.STRING(100),
    defaultValue: 'America/Chicago'
  },
  facility_latitude: {
    type: DataTypes.DOUBLE
  },
  facility_longitude: {
    type: DataTypes.DOUBLE
  },
  facility_daily_start_time: {
    type: DataTypes.TIME
  },
  facility_daily_end_time: {
    type: DataTypes.TIME
  },
  facility_default_duration: {
    type: DataTypes.INTEGER,
    defaultValue: 60
  },
  admin_user_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'user',
      key: 'user_id'
    }
  },
  business_hours: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  ice_resurfacing_duration: {
    type: DataTypes.INTEGER,
    defaultValue: 15
  },
  min_booking_duration: {
    type: DataTypes.INTEGER,
    defaultValue: 60
  },
  max_booking_duration: {
    type: DataTypes.INTEGER,
    defaultValue: 180
  },
  advance_booking_days: {
    type: DataTypes.INTEGER,
    defaultValue: 90
  },
  cancellation_hours: {
    type: DataTypes.INTEGER,
    defaultValue: 24
  },
  pricing_rules: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  maintenance_schedule: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'facility',
  timestamps: true,
  createdAt: 'create_ts',
  updatedAt: 'update_ts',
  underscored: true
});

// Associations will be defined in models/index.js
Facility.associate = function(models) {
  Facility.belongsTo(models.User, {
    foreignKey: 'admin_user_id',
    as: 'adminUser'
  });
  
  Facility.hasMany(models.Resource, {
    foreignKey: 'facility_id',
    as: 'resources'
  });
  
  Facility.hasMany(models.FacilityHours, {
    foreignKey: 'facility_id',
    as: 'operatingHours'
  });
  
  Facility.hasMany(models.FacilityPricing, {
    foreignKey: 'facility_id',
    as: 'pricingRules'
  });
};

module.exports = Facility;