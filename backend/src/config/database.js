const { Sequelize } = require('sequelize');
require('dotenv').config();

// Debug: Check if environment variables are loaded
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not defined in .env file');
  console.error('Current directory:', process.cwd());
  console.error('Looking for .env file in:', require('path').join(process.cwd(), '.env'));
  process.exit(1);
}

// Custom data type to handle timestamps as strings
class TIMESTAMP_NO_TZ extends Sequelize.DataTypes.ABSTRACT {
  toSql() {
    return 'TIMESTAMP WITHOUT TIME ZONE';
  }
  
  _stringify(value) {
    if (!value) return null;
    
    // If it's already a string in the right format, return it
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
      return value;
    }
    
    // If it's a Date object, format it without timezone conversion
    if (value instanceof Date) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      const hours = String(value.getHours()).padStart(2, '0');
      const minutes = String(value.getMinutes()).padStart(2, '0');
      const seconds = String(value.getSeconds()).padStart(2, '0');
      
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
    
    // Try to parse and reformat
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
    
    return null;
  }
  
  _sanitize(value) {
    return value;
  }
  
  _isChanged(value, originalValue) {
    return value !== originalValue;
  }
  
  static parse(value) {
    return value; // Return as-is, no parsing
  }
}

// Register the custom type
Sequelize.DataTypes.TIMESTAMP_NO_TZ = TIMESTAMP_NO_TZ;

// Parse DATABASE_URL or use individual env variables
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  timezone: '+00:00',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    },
    // Don't parse dates
    dateStrings: true,
    typeCast: false
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Export both sequelize and the custom type
module.exports = sequelize;
module.exports.TIMESTAMP_NO_TZ = TIMESTAMP_NO_TZ;