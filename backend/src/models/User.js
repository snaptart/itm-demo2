const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  user_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  user_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      isIn: [['admin', 'scheduler']]
    }
  },
  first_name: {
    type: DataTypes.STRING(50)
  },
  last_name: {
    type: DataTypes.STRING(50)
  },
  phone: {
    type: DataTypes.STRING(20)
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  last_login_ts: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'user',
  timestamps: true,
  createdAt: 'create_ts',
  updatedAt: 'update_ts'
});

// Instance method to verify password
User.prototype.verifyPassword = async function(password) {
  return await bcrypt.compare(password, this.password_hash);
};

// Instance method to update last login
User.prototype.updateLastLogin = async function() {
  this.last_login_ts = new Date();
  await this.save();
};

module.exports = User;