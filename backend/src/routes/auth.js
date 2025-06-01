const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ 
        message: 'Username and password are required' 
      });
    }

    // Find user by username or email
    const user = await User.findOne({
      where: {
        [require('sequelize').Op.or]: [
          { username },
          { email: username }
        ]
      }
    });

    if (!user) {
      return res.status(401).json({ 
        message: 'Invalid credentials' 
      });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({ 
        message: 'Account is inactive' 
      });
    }

    // Verify password
    const isValidPassword = await user.verifyPassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ 
        message: 'Invalid credentials' 
      });
    }

    // Update last login
    await user.updateLastLogin();

    // Generate JWT token
    const token = jwt.sign(
      { 
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        user_type: user.user_type,
        first_name: user.first_name,
        last_name: user.last_name
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Send response
    res.json({
      token,
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        user_type: user.user_type,
        first_name: user.first_name,
        last_name: user.last_name
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: 'An error occurred during login' 
    });
  }
});

// Get current user profile (protected route)
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.user_id, {
      attributes: { exclude: ['password_hash'] }
    });

    if (!user) {
      return res.status(404).json({ 
        message: 'User not found' 
      });
    }

    res.json(user);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ 
      message: 'An error occurred fetching profile' 
    });
  }
});

// Logout endpoint (optional - mainly for client-side token removal)
router.post('/logout', authenticateToken, (req, res) => {
  // In a JWT system, logout is typically handled client-side
  // This endpoint can be used for logging or blacklisting tokens if needed
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;