require('dotenv').config();
const { User } = require('./src/models');
const bcrypt = require('bcrypt');

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Find a user
    const user = await User.findOne({
      where: { username: 'burnsville_admin' }
    });
    
    if (user) {
      console.log('Found user:', {
        username: user.username,
        email: user.email,
        user_type: user.user_type,
        is_active: user.is_active
      });
      
      // Test password
      const testPassword = 'demo123';
      const hash = await bcrypt.hash(testPassword, 10);
      console.log('\nTo set password to "demo123", run this SQL:');
      console.log(`UPDATE "user" SET password_hash = '${hash}' WHERE username = 'burnsville_admin';`);
      
      // Test current password
      console.log('\nTesting current password...');
      const isValid = await user.verifyPassword('demo123');
      console.log('Password "demo123" is valid:', isValid);
      
    } else {
      console.log('User not found!');
    }
    
    // List all users
    console.log('\nAll users in database:');
    const allUsers = await User.findAll({
      attributes: ['user_id', 'username', 'email', 'user_type', 'is_active']
    });
    
    allUsers.forEach(u => {
      console.log(`- ${u.username} (${u.email}) - ${u.user_type} - Active: ${u.is_active}`);
    });
    
  } catch (error) {
    console.error('Database test error:', error);
  } finally {
    process.exit(0);
  }
}

testDatabase();