import React, { useState } from 'react';
import authService from '../services/authService';
import './LoginForm.css';

function LoginForm({ onLoginSuccess }) {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(''); // Clear error when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    console.log('Attempting login with:', formData.username);
    
    const result = await authService.login(
      formData.username,
      formData.password
    );

    console.log('Login result:', result);

    if (result.success) {
      console.log('Login successful, calling onLoginSuccess');
      onLoginSuccess(result.user);
    } else {
      console.log('Login failed:', result.error);
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>RinkFinder Login</h2>
        <p className="login-subtitle">Ice Time Management System</p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username or Email</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              placeholder="Enter username or email"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Enter password"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="test-accounts">
          <p>Test Accounts:</p>
          <small>Admin: burnsville_admin / demo123</small><br />
          <small>Scheduler: hockey_scheduler / demo123</small>
        </div>
      </div>
    </div>
  );
}

export default LoginForm;