const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FacilityHours = sequelize.define('FacilityHours', {
  hours_id: {
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
  day_of_week: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0,
      max: 6
    }
  },
  open_time: {
    type: DataTypes.TIME,
    allowNull: false
  },
  close_time: {
    type: DataTypes.TIME,
    allowNull: false
  },
  is_closed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'facility_hours',
  timestamps: true,
  createdAt: 'create_ts',
  updatedAt: 'update_ts'
});

// Associations
FacilityHours.associate = function(models) {
  FacilityHours.belongsTo(models.Facility, {
    foreignKey: 'facility_id',
    as: 'facility'
  });
};

module.exports = FacilityHours;