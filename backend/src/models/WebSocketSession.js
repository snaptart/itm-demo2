// backend/src/models/WebSocketSession.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WebSocketSession = sequelize.define('WebSocketSession', {
  session_id: {
    type: DataTypes.STRING(255),
    primaryKey: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'user',
      key: 'user_id'
    }
  },
  socket_id: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  facility_ids: {
    type: DataTypes.ARRAY(DataTypes.INTEGER),
    defaultValue: []
  },
  program_ids: {
    type: DataTypes.ARRAY(DataTypes.INTEGER),
    defaultValue: []
  },
  user_agent: {
    type: DataTypes.TEXT
  },
  ip_address: {
    type: DataTypes.INET
  },
  last_activity: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  joined_rooms: {
    type: DataTypes.ARRAY(DataTypes.STRING(100)),
    defaultValue: []
  }
}, {
  tableName: 'websocket_session',
  timestamps: true,
  createdAt: 'connected_at',
  updatedAt: false,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['socket_id'] },
    { fields: ['last_activity'] },
    { fields: ['facility_ids'] },
    { fields: ['program_ids'] }
  ]
});

// Instance methods
WebSocketSession.prototype.updateActivity = async function() {
  this.last_activity = new Date();
  await this.save();
};

WebSocketSession.prototype.joinRoom = async function(roomName) {
  if (!this.joined_rooms.includes(roomName)) {
    this.joined_rooms = [...this.joined_rooms, roomName];
    await this.save();
  }
};

WebSocketSession.prototype.leaveRoom = async function(roomName) {
  this.joined_rooms = this.joined_rooms.filter(room => room !== roomName);
  await this.save();
};

WebSocketSession.prototype.subscribeFacility = async function(facilityId) {
  if (!this.facility_ids.includes(facilityId)) {
    this.facility_ids = [...this.facility_ids, facilityId];
    await this.save();
  }
};

WebSocketSession.prototype.unsubscribeFacility = async function(facilityId) {
  this.facility_ids = this.facility_ids.filter(id => id !== facilityId);
  await this.save();
};

WebSocketSession.prototype.subscribeProgram = async function(programId) {
  if (!this.program_ids.includes(programId)) {
    this.program_ids = [...this.program_ids, programId];
    await this.save();
  }
};

WebSocketSession.prototype.unsubscribeProgram = async function(programId) {
  this.program_ids = this.program_ids.filter(id => id !== programId);
  await this.save();
};

WebSocketSession.prototype.isActive = function() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return new Date(this.last_activity) > fiveMinutesAgo;
};

// Class methods
WebSocketSession.findBySocketId = async function(socketId) {
  return await this.findOne({ 
    where: { socket_id: socketId },
    include: ['user']
  });
};

WebSocketSession.findByUserId = async function(userId) {
  return await this.findAll({ 
    where: { user_id: userId },
    order: [['last_activity', 'DESC']]
  });
};

WebSocketSession.getActiveSessionsForFacility = async function(facilityId) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  return await this.findAll({
    where: {
      facility_ids: {
        [sequelize.Op.contains]: [facilityId]
      },
      last_activity: {
        [sequelize.Op.gt]: oneHourAgo
      }
    },
    include: ['user']
  });
};

WebSocketSession.getActiveSessionsForProgram = async function(programId) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  return await this.findAll({
    where: {
      program_ids: {
        [sequelize.Op.contains]: [programId]
      },
      last_activity: {
        [sequelize.Op.gt]: oneHourAgo
      }
    },
    include: ['user']
  });
};

WebSocketSession.cleanupInactive = async function(hoursOld = 1) {
  const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
  
  const deletedCount = await this.destroy({
    where: {
      last_activity: {
        [sequelize.Op.lt]: cutoffTime
      }
    }
  });
  
  console.log(`Cleaned up ${deletedCount} inactive WebSocket sessions`);
  return deletedCount;
};

WebSocketSession.getSessionStats = async function() {
  const totalSessions = await this.count();
  const activeThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes
  
  const activeSessions = await this.count({
    where: {
      last_activity: {
        [sequelize.Op.gt]: activeThreshold
      }
    }
  });
  
  const uniqueUsers = await this.count({
    distinct: true,
    col: 'user_id',
    where: {
      last_activity: {
        [sequelize.Op.gt]: activeThreshold
      }
    }
  });
  
  return {
    total_sessions: totalSessions,
    active_sessions: activeSessions,
    unique_active_users: uniqueUsers,
    timestamp: new Date()
  };
};

// Hooks
WebSocketSession.addHook('beforeCreate', (session) => {
  // Generate session ID if not provided
  if (!session.session_id) {
    session.session_id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
});

// Associations
WebSocketSession.associate = function(models) {
  WebSocketSession.belongsTo(models.User, {
    foreignKey: 'user_id',
    as: 'user'
  });
};

module.exports = WebSocketSession;