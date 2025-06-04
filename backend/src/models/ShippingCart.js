// backend/src/models/ShoppingCart.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ShoppingCart = sequelize.define('ShoppingCart', {
  cart_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'user',
      key: 'user_id'
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
  episode_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'episode',
      key: 'episode_id'
    }
  },
  facility_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'facility',
      key: 'facility_id'
    }
  },
  resource_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'resource',
      key: 'resource_id'
    }
  },
  // Cached episode details for performance
  episode_start_date_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  episode_end_date_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  episode_title: {
    type: DataTypes.STRING(100)
  },
  episode_price: {
    type: DataTypes.DECIMAL(10, 2)
  },
  resource_name: {
    type: DataTypes.STRING(100)
  },
  facility_name: {
    type: DataTypes.STRING(100)
  },
  // Cart metadata
  session_id: {
    type: DataTypes.STRING(255)
  },
  notes: {
    type: DataTypes.TEXT
  },
  priority: {
    type: DataTypes.STRING(20),
    defaultValue: 'normal',
    validate: {
      isIn: [['low', 'normal', 'high', 'urgent']]
    }
  }
}, {
  tableName: 'shopping_cart',
  timestamps: true,
  createdAt: 'added_at',
  updatedAt: false,
  indexes: [
    { fields: ['user_id', 'program_id'] },
    { fields: ['facility_id'] },
    { fields: ['episode_id'] },
    { fields: ['added_at'] }
  ]
});

// Instance methods
ShoppingCart.prototype.getDuration = function() {
  return Math.round((new Date(this.episode_end_date_time) - new Date(this.episode_start_date_time)) / (1000 * 60));
};

ShoppingCart.prototype.isExpired = function() {
  return new Date(this.episode_start_date_time) < new Date();
};

// Class methods
ShoppingCart.getUserCartCount = async function(userId) {
  return await this.count({ where: { user_id: userId } });
};

ShoppingCart.getUserCartTotal = async function(userId) {
  const items = await this.findAll({
    where: { user_id: userId },
    attributes: ['episode_price']
  });
  return items.reduce((total, item) => total + (parseFloat(item.episode_price) || 0), 0);
};

// Associations
ShoppingCart.associate = function(models) {
  ShoppingCart.belongsTo(models.User, {
    foreignKey: 'user_id',
    as: 'user'
  });
  
  ShoppingCart.belongsTo(models.Program, {
    foreignKey: 'program_id',
    as: 'program'
  });
  
  ShoppingCart.belongsTo(models.Episode, {
    foreignKey: 'episode_id',
    as: 'episode'
  });
  
  ShoppingCart.belongsTo(models.Facility, {
    foreignKey: 'facility_id',
    as: 'facility'
  });
  
  ShoppingCart.belongsTo(models.Resource, {
    foreignKey: 'resource_id',
    as: 'resource'
  });
};

module.exports = ShoppingCart;