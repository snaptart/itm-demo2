// Test script to verify .env file is loading
require('dotenv').config();

console.log('Current directory:', process.cwd());
console.log('.env file path:', require('path').join(process.cwd(), '.env'));
console.log('\nEnvironment variables:');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Found (hidden for security)' : 'NOT FOUND');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Found' : 'NOT FOUND');
console.log('PORT:', process.env.PORT || 'NOT FOUND');
console.log('FRONTEND_URL:', process.env.FRONTEND_URL || 'NOT FOUND');
console.log('NODE_ENV:', process.env.NODE_ENV || 'NOT FOUND');

// Check if .env file exists
const fs = require('fs');
const path = require('path');
const envPath = path.join(process.cwd(), '.env');

if (fs.existsSync(envPath)) {
  console.log('\n✓ .env file exists at:', envPath);
  console.log('File size:', fs.statSync(envPath).size, 'bytes');
} else {
  console.log('\n✗ .env file NOT FOUND at:', envPath);
}