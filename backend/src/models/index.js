const sequelize = require('../config/database');
const User = require('./User');
const Facility = require('./Facility');
const Resource = require('./Resource');
const ResourceType = require('./ResourceType');
const FacilityHours = require('./FacilityHours');
const FacilityPricing = require('./FacilityPricing');
const Event = require('./Event');
const Episode = require('./Episode');
const Program = require('./Program');
const ProgramType = require('./ProgramType');
const Booking = require('./Booking');
// Future models to be imported
// const Notification = require('./Notification');
// const AuditLog = require('./AuditLog');

// Create model object
const models = {
  sequelize,
  User,
  Facility,
  Resource,
  ResourceType,
  FacilityHours,
  FacilityPricing,
  Event,
  Episode,
  Program,
  ProgramType,
  Booking
};

// Define associations
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

// Export models and sequelize instance
module.exports = models;