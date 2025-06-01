import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import authService from './services/authService';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <h1>RinkFinder</h1>
          <div className="user-info">
            <span className="welcome-text">
              Welcome, {user.first_name || user.username}!
            </span>
            <span className="user-type">({user.user_type})</span>
            <button onClick={handleLogout} className="logout-button">
              Logout
            </button>
          </div>
        </div>
      </header>
      
      <main className="app-main">
        <div className="dashboard">
          <h2>Dashboard</h2>
          <div className="info-card">
            <h3>User Information</h3>
            <p><strong>Username:</strong> {user.username}</p>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Role:</strong> {user.user_type}</p>
            <p><strong>Name:</strong> {user.first_name} {user.last_name}</p>
          </div>
          
          <div className="coming-soon">
            <h3>Coming Soon</h3>
            <ul>
              <li>View facility schedules</li>
              <li>Book ice time slots</li>
              <li>Manage bookings</li>
              <li>Real-time notifications</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;