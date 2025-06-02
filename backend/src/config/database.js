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

// Parse DATABASE_URL or use individual env variables
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  timezone: '+00:00', // Treat all times as UTC+0 (no conversion)
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    },
	useUTC: false, // Don't convert to UTC
    // Optional: Force PostgreSQL to not interpret timezones
    timezone: 'Etc/GMT0'
  }
});

module.exports = sequelize;