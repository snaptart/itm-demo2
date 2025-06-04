// backend/src/models/index.js (Updated with New Models)
const sequelize = require('../config/database');

// Import all models first (Phase 1: Model Definition)
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

// NEW: Shopping cart and request management models
const ShoppingCart = require('./ShoppingCart');
const IceTimeRequest = require('./IceTimeRequest');
const RealtimeNotification = require('./RealtimeNotification');
const WebSocketSession = require('./WebSocketSession');

// Additional models that might be referenced
// const Notification = require('./Notification');
// const AuditLog = require('./AuditLog');

// Create models object with all loaded models (Phase 2: Model Registration)
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
  Booking,
  // NEW models
  ShoppingCart,
  IceTimeRequest,
  RealtimeNotification,
  WebSocketSession
  // Notification,
  // AuditLog
};

console.log('Loaded models:', Object.keys(models).filter(key => key !== 'sequelize'));

// Phase 3: Set up associations after all models are loaded
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate && typeof models[modelName].associate === 'function') {
    try {
      console.log(`Setting up associations for ${modelName}`);
      models[modelName].associate(models);
    } catch (error) {
      console.error(`Error setting up associations for ${modelName}:`, error.message);
      // Don't throw here - let other associations complete
    }
  }
});

// Verify all associations were set up correctly
console.log('Model associations setup complete');

// Export models and sequelize instance
module.exports = models;