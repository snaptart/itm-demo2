// backend/src/models/IceTimeRequest.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const IceTimeRequest = sequelize.define('IceTimeRequest', {
  request_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  request_number: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false
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
  // Request details
  requested_start_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  requested_end_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  request_duration: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  episode_price: {
    type: DataTypes.DECIMAL(10, 2)
  },
  request_notes: {
    type: DataTypes.TEXT
  },
  priority: {
    type: DataTypes.STRING(20),
    defaultValue: 'normal',
    validate: {
      isIn: [['low', 'normal', 'high', 'urgent']]
    }
  },
  // Status workflow
  request_status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending',
    allowNull: false,
    validate: {
      isIn: [['pending', 'approved', 'rejected', 'cancelled', 'expired', 'confirmed']]
    }
  },
  // Workflow tracking
  reviewed_at: {
    type: DataTypes.DATE
  },
  reviewed_by_user_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'user',
      key: 'user_id'
    }
  },
  admin_notes: {
    type: DataTypes.TEXT
  },
  expires_at: {
    type: DataTypes.DATE
  },
  created_by: {
    type: DataTypes.STRING(30)
  },
  updated_by: {
    type: DataTypes.STRING(30)
  }
}, {
  tableName: 'ice_time_request',
  timestamps: true,
  createdAt: 'submitted_at',
  updatedAt: 'update_ts',
  indexes: [
    { fields: ['user_id', 'program_id'] },
    { fields: ['request_status'] },
    { fields: ['facility_id'] },
    { fields: ['episode_id'] },
    { fields: ['submitted_at'] },
    { fields: ['expires_at'] }
  ]
});

// Instance methods
IceTimeRequest.prototype.canBeModified = function() {
  return ['pending'].includes(this.request_status);
};

IceTimeRequest.prototype.canBeCancelled = function() {
  return ['pending', 'approved'].includes(this.request_status);
};

IceTimeRequest.prototype.isExpired = function() {
  return this.expires_at && new Date(this.expires_at) < new Date();
};

IceTimeRequest.prototype.getStatusDisplay = function() {
  const statusMap = {
    'pending': { label: 'Pending Review', color: '#f6ad55', icon: '⏳' },
    'approved': { label: 'Approved', color: '#48bb78', icon: '✅' },
    'rejected': { label: 'Rejected', color: '#fc8181', icon: '❌' },
    'cancelled': { label: 'Cancelled', color: '#a0aec0', icon: '🚫' },
    'confirmed': { label: 'Confirmed', color: '#4299e1', icon: '📅' },
    'expired': { label: 'Expired', color: '#9e9e9e', icon: '⌛' }
  };
  
  return statusMap[this.request_status] || { label: this.request_status, color: '#a0aec0', icon: '❓' };
};

IceTimeRequest.prototype.calculateTimeUntilExpiry = function() {
  if (!this.expires_at) return null;
  
  const now = new Date();
  const expiry = new Date(this.expires_at);
  
  if (expiry <= now) return 0;
  
  return Math.round((expiry - now) / (1000 * 60 * 60)); // hours
};

// Class methods
IceTimeRequest.getPendingCount = async function(facilityId = null) {
  const where = { request_status: 'pending' };
  if (facilityId) where.facility_id = facilityId;
  
  return await this.count({ where });
};

IceTimeRequest.getRequestsByStatus = async function(status, facilityId = null) {
  const where = { request_status: status };
  if (facilityId) where.facility_id = facilityId;
  
  return await this.findAll({
    where,
    include: ['user', 'program', 'facility', 'resource', 'episode'],
    order: [['submitted_at', 'DESC']]
  });
};

// Hooks
IceTimeRequest.addHook('beforeCreate', (request) => {
  // Auto-generate request number if not provided
  if (!request.request_number) {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString(36);
    request.request_number = `REQ-${year}-${timestamp.toUpperCase()}`;
  }
  
  // Set expiration (24 hours for pending requests)
  if (!request.expires_at && request.request_status === 'pending') {
    request.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  
  // Calculate duration
  if (request.requested_start_time && request.requested_end_time) {
    request.request_duration = Math.round(
      (new Date(request.requested_end_time) - new Date(request.requested_start_time)) / (1000 * 60)
    );
  }
});

IceTimeRequest.addHook('beforeUpdate', (request) => {
  // Update timestamp
  request.updated_by = request.updated_by || 'system';
  
  // Set reviewed timestamp when status changes from pending
  if (request.changed('request_status') && request.previous('request_status') === 'pending') {
    request.reviewed_at = new Date();
  }
  
  // Clear expiration when approved/rejected
  if (['approved', 'rejected', 'confirmed'].includes(request.request_status)) {
    request.expires_at = null;
  }
});

// Associations
IceTimeRequest.associate = function(models) {
  IceTimeRequest.belongsTo(models.User, {
    foreignKey: 'user_id',
    as: 'user'
  });
  
  IceTimeRequest.belongsTo(models.User, {
    foreignKey: 'reviewed_by_user_id',
    as: 'reviewedBy'
  });
  
  IceTimeRequest.belongsTo(models.Program, {
    foreignKey: 'program_id',
    as: 'program'
  });
  
  IceTimeRequest.belongsTo(models.Episode, {
    foreignKey: 'episode_id',
    as: 'episode'
  });
  
  IceTimeRequest.belongsTo(models.Facility, {
    foreignKey: 'facility_id',
    as: 'facility'
  });
  
  IceTimeRequest.belongsTo(models.Resource, {
    foreignKey: 'resource_id',
    as: 'resource'
  });
  
  IceTimeRequest.hasMany(models.RealtimeNotification, {
    foreignKey: 'target_id',
    as: 'notifications',
    scope: {
      target_type: 'request'
    }
  });
};

module.exports = IceTimeRequest;