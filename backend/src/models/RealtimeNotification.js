// backend/src/models/RealtimeNotification.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RealtimeNotification = sequelize.define('RealtimeNotification', {
  notification_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  target_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      isIn: [['user', 'facility', 'program', 'global']]
    }
  },
  target_id: {
    type: DataTypes.INTEGER
  },
  event_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  event_data: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  title: {
    type: DataTypes.STRING(200)
  },
  message: {
    type: DataTypes.TEXT
  },
  websocket_rooms: {
    type: DataTypes.ARRAY(DataTypes.STRING(500)),
    defaultValue: []
  },
  sent_at: {
    type: DataTypes.DATE
  },
  is_delivered: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_persistent: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  expires_at: {
    type: DataTypes.DATE
  },
  created_by_user_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'user',
      key: 'user_id'
    }
  }
}, {
  tableName: 'realtime_notification',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    { fields: ['target_type', 'target_id'] },
    { fields: ['event_type'] },
    { fields: ['is_delivered', 'sent_at'] },
    { fields: ['expires_at'] }
  ]
});

// Instance methods
RealtimeNotification.prototype.markAsDelivered = async function() {
  this.is_delivered = true;
  this.sent_at = new Date();
  await this.save();
};

RealtimeNotification.prototype.isExpired = function() {
  return this.expires_at && new Date(this.expires_at) < new Date();
};

// Class methods
RealtimeNotification.createForUser = async function(userId, eventType, data = {}) {
  return await this.create({
    target_type: 'user',
    target_id: userId,
    event_type: eventType,
    event_data: data,
    title: data.title,
    message: data.message,
    websocket_rooms: [`user_${userId}`],
    created_by_user_id: data.created_by_user_id
  });
};

RealtimeNotification.createForFacility = async function(facilityId, eventType, data = {}) {
  const rooms = [
    `facility_${facilityId}_admins`,
    `facility_${facilityId}_schedulers`
  ];
  
  return await this.create({
    target_type: 'facility',
    target_id: facilityId,
    event_type: eventType,
    event_data: data,
    title: data.title,
    message: data.message,
    websocket_rooms: rooms,
    created_by_user_id: data.created_by_user_id
  });
};

RealtimeNotification.createForProgram = async function(programId, eventType, data = {}) {
  return await this.create({
    target_type: 'program',
    target_id: programId,
    event_type: eventType,
    event_data: data,
    title: data.title,
    message: data.message,
    websocket_rooms: [`program_${programId}`],
    created_by_user_id: data.created_by_user_id
  });
};

RealtimeNotification.createGlobal = async function(eventType, data = {}) {
  return await this.create({
    target_type: 'global',
    target_id: null,
    event_type: eventType,
    event_data: data,
    title: data.title,
    message: data.message,
    websocket_rooms: ['global'],
    created_by_user_id: data.created_by_user_id
  });
};

RealtimeNotification.getPendingForDelivery = async function(limit = 100) {
  return await this.findAll({
    where: {
      is_delivered: false,
      [sequelize.Op.or]: [
        { expires_at: null },
        { expires_at: { [sequelize.Op.gt]: new Date() } }
      ]
    },
    order: [['created_at', 'ASC']],
    limit
  });
};

RealtimeNotification.cleanupExpired = async function() {
  const deletedCount = await this.destroy({
    where: {
      expires_at: {
        [sequelize.Op.lt]: new Date()
      }
    }
  });
  
  console.log(`Cleaned up ${deletedCount} expired notifications`);
  return deletedCount;
};

// Associations
RealtimeNotification.associate = function(models) {
  RealtimeNotification.belongsTo(models.User, {
    foreignKey: 'created_by_user_id',
    as: 'createdBy'
  });
};

module.exports = RealtimeNotification;