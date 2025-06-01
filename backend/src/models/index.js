const sequelize = require('../config/database');
const User = require('./User');

// Export models and sequelize instance
module.exports = {
  sequelize,
  User
};